/**
 * API Utility Functions
 * Centralized API configuration and error handling
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

/**
 * Check if backend server is accessible
 */
export const checkServerHealth = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    return response.ok;
  } catch (error) {
    return false;
  }
};

/**
 * Make API request with better error handling and timeout
 */
export const apiRequest = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error: unknown) {
    // Handle timeout/abort
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timeout - backend server may not be running");
    }
    // Handle network errors
    if (error instanceof Error && error.name === "TypeError" && error.message.includes("fetch")) {
      throw new Error(
        "Cannot connect to server. Please ensure the backend server is running on port 3001."
      );
    }
    throw error;
  }
};

/**
 * Parse API response with error handling
 */
export const parseApiResponse = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  
  if (!text) {
    throw new Error("Empty response from server");
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(text || "Invalid response from server");
  }
};

/**
 * Get user-friendly error message from various error types
 */
export const getUserFriendlyError = (error: unknown): string => {
  if (error instanceof Error) {
    // Handle common Supabase errors
    if (error.message.includes("JWT")) {
      return "Your session has expired. Please log in again.";
    }
    if (error.message.includes("duplicate key") || error.message.includes("unique constraint")) {
      return "This record already exists.";
    }
    if (error.message.includes("foreign key")) {
      return "Cannot complete this action due to related data.";
    }
    if (error.message.includes("permission denied") || error.message.includes("RLS")) {
      return "You don't have permission to perform this action.";
    }
    if (error.message.includes("network") || error.message.includes("fetch")) {
      return "Network error. Please check your connection and try again.";
    }
    if (error.message.includes("timeout")) {
      return "Request timed out. Please try again.";
    }
    return error.message;
  }
  return "An unexpected error occurred. Please try again.";
};

export { API_BASE_URL };




