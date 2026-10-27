"""
Kenyan National ID OCR + verification.

Reads a photo of a Kenyan National ID (old generation or Maisha card) with
Tesseract, extracts the ID number, date of birth and names, and compares them
with the values the customer typed during SIM registration.

Images are processed in memory only and never written to disk.
"""
from __future__ import annotations

import os
import re
import shutil
from dataclasses import dataclass, field, asdict
from datetime import datetime

import cv2
import numpy as np
import pytesseract
from rapidfuzz import fuzz

# Locate tesseract.exe on Windows if it is not on PATH.
_DEFAULT_WIN_PATH = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
_tess = os.environ.get("TESSERACT_CMD") or shutil.which("tesseract")
if not _tess and os.path.exists(_DEFAULT_WIN_PATH):
    _tess = _DEFAULT_WIN_PATH
if _tess:
    pytesseract.pytesseract.tesseract_cmd = _tess

NAME_TOKEN_THRESHOLD = 85  # rapidfuzz ratio needed for a typed name part (5+ letters)
DATE_RE = re.compile(r"(\d{1,2})\s*[.\-/,]\s*(\d{1,2})\s*[.\-/,]\s*(\d{4})")
# Labels printed on the card that must never be mistaken for a name.
LABEL_WORDS = {
    "REPUBLIC", "OF", "KENYA", "JAMHURI", "YA", "SERIAL", "NUMBER", "ID", "NO",
    "FULL", "NAMES", "NAME", "DATE", "BIRTH", "SEX", "MALE", "FEMALE", "DISTRICT",
    "PLACE", "ISSUE", "HOLDERS", "HOLDER", "SIGN", "SURNAME", "GIVEN", "NATIONALITY",
    "KEN", "EXPIRY", "CARD", "NATIONAL", "IDENTITY", "COUNTY",
}

# Characters Tesseract commonly confuses on ID-card fonts (e.g. a serif "I" read
# as "T"). Both the typed name and the OCR text are mapped to one representative
# per group before comparing, so these misreads don't count as mismatches.
_CONFUSABLE = str.maketrans({
    "T": "I", "L": "I", "J": "I", "1": "I", "|": "I", "!": "I", "l": "I",
    "0": "O", "Q": "O", "D": "O",
    "5": "S", "8": "B", "2": "Z", "6": "G",
})


@dataclass
class FieldCheck:
    match: bool
    expected: str
    found: str | None
    score: float | None = None
    note: str | None = None


@dataclass
class VerificationResult:
    verified: bool
    checks: dict[str, FieldCheck]
    extracted: dict[str, str | None]
    ocr_quality: str
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


# --------------------------------------------------------------------------- #
# Image preprocessing + OCR
# --------------------------------------------------------------------------- #
def _decode(image_bytes: bytes) -> np.ndarray:
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("The uploaded file is not a readable image.")
    return img


def _variants(img: np.ndarray) -> list[tuple[np.ndarray, tuple[int, ...]]]:
    """
    Preprocessed versions of the card, each with the Tesseract page modes to run.
    Kenyan IDs print black text over a red/green security pattern; in the RED
    channel the red pattern turns almost white, and a black-hat filter keeps only
    thin dark strokes, which recovers fields printed over the hologram (e.g. DOB).
    """
    scale = 1600 / max(img.shape[1], 1)
    img = cv2.resize(img, None, fx=scale, fy=scale,
                     interpolation=cv2.INTER_CUBIC if scale > 1 else cv2.INTER_AREA)
    red = img[:, :, 2]
    gray = cv2.bilateralFilter(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), 9, 75, 75)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 25))
    blackhat = cv2.morphologyEx(red, cv2.MORPH_BLACKHAT, kernel)
    strokes = 255 - cv2.normalize(blackhat, None, 0, 255, cv2.NORM_MINMAX)
    return [(strokes, (6, 11)), (red, (11, 4)), (gray, (6,))]


def run_ocr(image_bytes: bytes) -> str:
    img = _decode(image_bytes)
    texts = []
    for variant, psms in _variants(img):
        for psm in psms:
            texts.append(
                pytesseract.image_to_string(variant, lang="eng", config=f"--oem 3 --psm {psm}")
            )
    return "\n".join(texts)


# --------------------------------------------------------------------------- #
# Field extraction
# --------------------------------------------------------------------------- #
_OCR_DIGIT_FIX = str.maketrans({"O": "0", "o": "0", "D": "0", "Q": "0", "I": "1", "l": "1",
                                "|": "1", "S": "5", "s": "5", "B": "8", "Z": "2", "G": "6"})
_NUM_TOKEN = r"[0-9OoDQIl|SsBZG]{7,10}"


def _digit_candidates(text: str) -> list[str]:
    """All 7-9 digit runs, after fixing common letter/digit OCR confusions."""
    out = []
    for token in re.findall(_NUM_TOKEN, text):
        fixed = token.translate(_OCR_DIGIT_FIX)
        if fixed.isdigit() and 7 <= len(fixed) <= 9 and any(ch.isdigit() for ch in token):
            out.append(fixed)
    return out


def _serial_numbers(text: str) -> set[str]:
    """
    Card serial numbers; these must never be accepted as the ID number.
    Found by their label, or - since the labels are small and often misread -
    by position: on the old card the serial and the ID number share the top
    line, serial first, so the first of two numbers on one line is the serial.
    """
    serials = {m.translate(_OCR_DIGIT_FIX) for m in
               re.findall(r"SERIAL\s*N(?:UMBER|[O0]\.?)\s*[:.]?\s*([0-9OoIlSB]{7,10})", text, re.I)}
    for line in text.splitlines():
        nums = [t.translate(_OCR_DIGIT_FIX) for t in re.findall(r"\b\d{7,10}\b", line)]
        if len(nums) >= 2:
            serials.add(nums[0])
    return serials


def extract_id_number(text: str) -> str | None:
    labelled = re.search(r"\bID\s*N(?:UMBER|[O0]\.?)\s*[:.]?\s*([0-9OoIlSB]{7,9})", text, re.I)
    if labelled:
        fixed = labelled.group(1).translate(_OCR_DIGIT_FIX)
        if fixed.isdigit():
            return fixed
    serials = _serial_numbers(text)
    candidates = [c for c in _digit_candidates(text) if c not in serials and len(c) <= 8]
    return max(set(candidates), key=candidates.count) if candidates else None


def _parse_dates(text: str) -> list[datetime]:
    dates = []
    for d, m, y in DATE_RE.findall(text):
        try:
            dates.append(datetime(int(y), int(m), int(d)))
        except ValueError:
            continue
    return dates


def extract_dob(text: str) -> str | None:
    labelled = re.search(r"BIRTH[^0-9]{0,25}" + DATE_RE.pattern, text, re.I)
    if labelled:
        d, m, y = labelled.group(1), labelled.group(2), labelled.group(3)
        try:
            return datetime(int(y), int(m), int(d)).strftime("%Y-%m-%d")
        except ValueError:
            pass
    # Date of birth is the earliest plausible date on the card (issue/expiry dates are later).
    plausible = [d for d in _parse_dates(text) if 1900 < d.year <= datetime.now().year - 16]
    return min(plausible).strftime("%Y-%m-%d") if plausible else None


def extract_name(text: str) -> str | None:
    """Best-effort display of the name read from the card (shown to the user on mismatch)."""
    lines = [ln.strip() for ln in text.splitlines()]
    for i, ln in enumerate(lines):
        if re.search(r"FULL\s*NAMES?|SURNAME|GIVEN\s*NAMES?", ln, re.I):
            same_line = re.split(r"FULL\s*NAMES?|SURNAME|GIVEN\s*NAMES?", ln, flags=re.I)[-1]
            for chunk in [same_line] + lines[i + 1:i + 3]:
                words = [w for w in re.findall(r"[A-Za-z]{2,}", chunk) if w.upper() not in LABEL_WORDS]
                if len(words) >= 2:
                    return " ".join(w.upper() for w in words)
    # Label not read: fall back to the first line made only of 2+ capitalised words.
    for ln in lines:
        words = re.findall(r"[A-Z]{2,}", ln)
        if len(words) >= 2 and all(w not in LABEL_WORDS for w in words) and \
                re.fullmatch(r"[A-Z ]+", ln.strip() or "-"):
            return " ".join(words)
    return None


def _name_words(text: str) -> list[str]:
    return [w.upper() for w in re.findall(r"[A-Za-z0-9|!]{2,}", text)
            if w.upper() not in LABEL_WORDS and not w.isdigit()]


def _name_part_score(typed: str, ocr_word: str) -> float:
    """Similarity 0-100 between a typed name part and an OCR word, tolerant of OCR misreads."""
    a = typed.upper().translate(_CONFUSABLE)
    b = ocr_word.upper().translate(_CONFUSABLE)
    if a == b:
        return 100.0
    if len(a) <= 4:
        # Short names (IAN, TOM, ANN...) must match exactly after the look-alike mapping:
        # background noise produces many short junk words, so any extra tolerance
        # lets a different short name through.
        return 0.0
    return fuzz.ratio(a, b)


# --------------------------------------------------------------------------- #
# Verification against typed values
# --------------------------------------------------------------------------- #
def _normalise_typed_dob(value: str) -> str | None:
    value = value.strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d.%m.%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(value, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def verify_from_text(text: str, full_name: str, id_number: str, date_of_birth: str) -> VerificationResult:
    warnings: list[str] = []
    extracted = {
        "fullName": extract_name(text),
        "idNumber": extract_id_number(text),
        "dateOfBirth": extract_dob(text),
    }
    ocr_words = _name_words(text)
    quality = "good" if len(ocr_words) >= 6 and extracted["idNumber"] else (
        "poor" if len(ocr_words) < 3 else "fair")
    if quality == "poor":
        warnings.append("Very little text could be read. Retake the photo in good light, "
                        "flat on a table, with the whole card in frame.")

    # --- Name: every typed name part must appear on the card (order-free, OCR-tolerant).
    typed_parts = [p.upper() for p in re.findall(r"[A-Za-z]{2,}", full_name)]
    part_scores = [max((_name_part_score(p, w) for w in ocr_words), default=0.0) for p in typed_parts]
    name_ok = len(typed_parts) >= 2 and all(s >= NAME_TOKEN_THRESHOLD for s in part_scores)
    name_note = None
    if len(typed_parts) < 2:
        name_note = "Enter at least two names as they appear on the ID."
    elif not name_ok:
        missing = [p for p, s in zip(typed_parts, part_scores) if s < NAME_TOKEN_THRESHOLD]
        name_note = "Not found on ID: " + ", ".join(missing)
    name_check = FieldCheck(
        match=name_ok, expected=full_name.strip(), found=extracted["fullName"],
        score=round(min(part_scores), 1) if part_scores else 0.0, note=name_note,
    )

    # --- ID number: must match exactly, and must not be the card's serial number.
    typed_id = re.sub(r"\D", "", id_number)
    serials = _serial_numbers(text)
    all_ids = set(_digit_candidates(text)) - serials
    if extracted["idNumber"]:
        all_ids.add(extracted["idNumber"])
    id_ok = bool(typed_id) and typed_id in all_ids
    id_note = None
    if not id_ok:
        id_note = ("That is the card's serial number. Enter the ID NUMBER printed on the right."
                   if typed_id in serials else "ID number on the card does not match what was entered.")
    id_check = FieldCheck(match=id_ok, expected=typed_id, found=extracted["idNumber"], note=id_note)

    # --- Date of birth: must match exactly.
    typed_dob = _normalise_typed_dob(date_of_birth)
    card_dates = {d.strftime("%Y-%m-%d") for d in _parse_dates(text)}
    if extracted["dateOfBirth"]:
        card_dates.add(extracted["dateOfBirth"])
    dob_ok = typed_dob is not None and typed_dob in card_dates
    dob_check = FieldCheck(
        match=dob_ok, expected=typed_dob or date_of_birth, found=extracted["dateOfBirth"],
        note=None if dob_ok else ("Date of birth format not recognised (use YYYY-MM-DD)."
                                  if typed_dob is None else
                                  "Date of birth on the card does not match what was entered."),
    )

    checks = {"fullName": name_check, "idNumber": id_check, "dateOfBirth": dob_check}
    return VerificationResult(
        verified=all(c.match for c in checks.values()),
        checks=checks,
        extracted=extracted,
        ocr_quality=quality,
        warnings=warnings,
    )


def verify_kenyan_id(image_bytes: bytes, full_name: str, id_number: str, date_of_birth: str) -> VerificationResult:
    return verify_from_text(run_ocr(image_bytes), full_name, id_number, date_of_birth)
