const API_BASE_URL = 'http://localhost:5000/api';

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

export async function loginApi(email: string, password: string): Promise<AuthApiResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Login failed. Please check your credentials.',
      };
    }

    return data;
  } catch (err) {
    console.error('Backend API connection error:', err);
    return {
      success: false,
      message: 'Unable to connect to backend database server (http://localhost:5000). Please ensure the backend service is running.',
    };
  }
}

export async function registerApi(fullName: string, email: string, password: string, role: string): Promise<AuthApiResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fullName, email, password, role }),
    });

    const data = await response.json();
    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Registration failed. Please check input parameters.',
      };
    }

    return data;
  } catch (err) {
    console.error('Backend API connection error:', err);
    return {
      success: false,
      message: 'Unable to connect to backend database server (http://localhost:5000). Please ensure the backend service is running.',
    };
  }
}
