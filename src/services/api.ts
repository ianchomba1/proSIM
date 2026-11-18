// Backend API root. Override with VITE_API_BASE (e.g. "/api" to go through the Vite dev proxy).
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE ?? "http://localhost:5000/api";

export interface UserResponse {
  id: string;
  fullName: string;
  email: string;
  role: string;
  createdAt: string;
}

export interface AuthApiResponse {
  success: boolean;
  message: string;
  user?: UserResponse;
}

export async function loginApi(
  email: string,
  password: string,
): Promise<AuthApiResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        success: false,
        message: data.message || "Login failed. Please check your credentials.",
      };
    }

    return data;
  } catch (err) {
    console.error("Backend API connection error:", err);
    return {
      success: false,
      message:
        "Could not connect to authentication server. Please ensure the backend service is running and PostgreSQL is connected.",
    };
  }
}

export async function registerApi(
  fullName: string,
  email: string,
  password: string,
  role: string,
): Promise<AuthApiResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fullName, email, password, role }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        success: false,
        message:
          data.message || "Registration failed. Please check input parameters.",
      };
    }

    return data;
  } catch (err) {
    console.error("Backend API connection error:", err);
    return {
      success: false,
      message:
        "Could not connect to registration server. Please ensure the backend service is running and PostgreSQL is connected.",
    };
  }
}

export type ApplicationStatus = "Pending" | "Approved" | "Rejected";

export interface ApplicationItem {
  applicationId: string;
  /** Set once the application is approved and the applicant is registered as a subscriber. */
  subscriberId?: string | null;
  /** Set once the application is approved and the SIM card is issued. */
  simCardId?: string | null;
  applicationStatus: ApplicationStatus;
  submissionDate: string;
  reviewDate?: string | null;
  reviewedBy?: string | null;
  reviewedByName?: string | null;
  remarks?: string | null;
  dateOfBirth?: string | null;
  fullName: string;
  institutionalId: string;
  nationalIdNumber?: string;
  idVerifiedAt?: string;
  department: string;
  contactPhone: string;
  iccid?: string;
  simPhone?: string;
  simStatus?: string;
  createdAt: string;
}

export interface SubmitApplicationData {
  fullName: string;
  institutionalId: string;
  dateOfBirth?: string;
  department: string;
  contactPhone: string;
  userEmail?: string;
  iccid?: string;
  nationalIdNumber: string;
  verificationToken: string;
}

export interface IdFieldCheck {
  match: boolean;
  expected: string;
  found: string | null;
  score?: number | null;
  note?: string | null;
}

export interface IdVerificationResult {
  verified: boolean;
  verificationToken?: string | null;
  checks?: { fullName: IdFieldCheck; idNumber: IdFieldCheck; dateOfBirth: IdFieldCheck };
  extracted?: { fullName: string | null; idNumber: string | null; dateOfBirth: string | null };
  ocrQuality?: string;
  warnings?: string[];
  message?: string;
}

export async function verifyNationalIdApi(
  image: File,
  fullName: string,
  nationalIdNumber: string,
  dateOfBirth: string
): Promise<IdVerificationResult> {
  const form = new FormData();
  form.append("image", image);
  form.append("fullName", fullName);
  form.append("nationalIdNumber", nationalIdNumber);
  form.append("dateOfBirth", dateOfBirth);
  try {
    const response = await fetch(`${API_BASE_URL}/verification/national-id`, {
      method: "POST",
      body: form,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { verified: false, message: data.message || "ID verification failed." };
    }
    return data;
  } catch (err) {
    console.error("ID verification API error:", err);
    return { verified: false, message: "Could not connect to the backend server." };
  }
}

export async function submitApplicationApi(
  data: SubmitApplicationData
): Promise<{ success: boolean; message: string; application?: ApplicationItem }> {
  try {
    const response = await fetch(`${API_BASE_URL}/applications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        success: false,
        message: result.message || "Failed to submit registration application.",
      };
    }
    return result;
  } catch (err) {
    console.error("Submit application API error:", err);
    return {
      success: false,
      message: "Could not connect to the backend server.",
    };
  }
}

/** All applications (or only those with `status`), newest first. Throws with a readable message on failure. */
export async function fetchApplicationsApi(status?: ApplicationStatus): Promise<ApplicationItem[]> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/applications${status ? `?status=${status}` : ""}`);
  } catch {
    throw new Error("Could not connect to the backend server.");
  }
  if (!response.ok) {
    throw new Error(`Failed to load applications (${response.status}).`);
  }
  return await response.json();
}

export interface ReviewResult {
  success: boolean;
  message: string;
  application?: ApplicationItem;
}

async function postReview(path: string, body: object): Promise<ReviewResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/applications/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { success: false, message: data.message || `Request failed (${response.status}).` };
    }
    return data;
  } catch (err) {
    console.error("Application review API error:", err);
    return { success: false, message: "Could not connect to the backend server." };
  }
}

/**
 * Approve a pending application: the backend creates the SIM card (SimCards) and registers the applicant
 * (Subscribers). Leave iccid / phone empty to have unique ones generated.
 */
export const approveApplicationApi = (
  id: string,
  opts: { iccid?: string; phone?: string; remarks?: string; reviewerUserId?: string }
) =>
  postReview(`${id}/approve`, {
    iccid: opts.iccid || null,
    phone: opts.phone || null,
    remarks: opts.remarks || null,
    reviewerUserId: opts.reviewerUserId || null,
  });

/** Reject a pending application. A reason is required. */
export const rejectApplicationApi = (id: string, remarks: string, reviewerUserId?: string) =>
  postReview(`${id}/reject`, { remarks, reviewerUserId: reviewerUserId || null });

