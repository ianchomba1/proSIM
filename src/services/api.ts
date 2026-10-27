const API_BASE_URL = "http://localhost:5000/api";

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

export interface ApplicationItem {
  applicationId: string;
  subscriberId: string;
  simCardId?: string;
  applicationStatus: string;
  submissionDate: string;
  reviewDate?: string;
  reviewedBy?: string;
  remarks?: string;
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

export async function fetchApplicationsApi(): Promise<ApplicationItem[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/applications`);
    if (!response.ok) {
      throw new Error(`Failed to fetch applications: ${response.statusText}`);
    }
    return await response.json();
  } catch (err) {
    console.error("Fetch applications API error:", err);
    return [];
  }
}

export async function updateApplicationStatusApi(
  id: string,
  status: string,
  remarks?: string,
  reviewerUserId?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/applications/${id}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status, remarks, reviewerUserId }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        success: false,
        message: data.message || "Failed to update application status.",
      };
    }
    return data;
  } catch (err) {
    console.error("Update status API error:", err);
    return {
      success: false,
      message: "Could not connect to backend server.",
    };
  }
}

