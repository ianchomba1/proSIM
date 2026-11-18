// Client for the signed-in user's profile (/api/profile/{userId}).
import { API_BASE_URL } from "./api";

export interface UserProfile {
  userId: string;
  fullName: string;
  email: string;
  role: string;
  memberSince: string;
  activity: {
    applicationsApproved: number;
    applicationsRejected: number;
    alertsConfirmed: number;
    alertsFalseAlarm: number;
    simsAdded: number;
    employeesAdded: number;
    lastReviewAt: string | null;
  };
}

export async function fetchProfile(userId: string): Promise<UserProfile> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/profile/${encodeURIComponent(userId)}`);
  } catch {
    throw new Error("Could not connect to the backend server. Is it running on port 5000?");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error((data && data.message) || `Request failed (${response.status}).`);
  }
  return data as UserProfile;
}
