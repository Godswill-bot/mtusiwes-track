/**
 * Frontend Audit Logging Utility
 * Logs user activities to the backend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

interface ProfileUpdateParams {
  userId: string;
  userType: string;
  userEmail: string;
  tableName: string;
  recordId: string;
  oldValue: Record<string, unknown>;
  newValue: Record<string, unknown>;
  changes: string[];
}

/**
 * Log profile update
 */
export const logProfileUpdate = async (params: ProfileUpdateParams) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/audit/profile-update`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      console.error("Failed to log profile update");
    }
  } catch (error) {
    console.error("Error logging profile update:", error);
  }
};

