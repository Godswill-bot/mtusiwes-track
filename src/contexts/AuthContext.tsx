import { createContext, useContext, useEffect, useState } from "react";
import { User, Session, AuthError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

type AppRole = "student" | "industry_supervisor" | "school_supervisor" | "admin";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: AppRole | null;
  profile: { full_name: string; role: string } | null;
  loading: boolean;
  /** True once the initial auth check has completed (session restored or confirmed absent) */
  isInitialized: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | Error | unknown | null }>;
  signUp: (email: string, password: string, fullName: string, role: AppRole) => Promise<{ error: AuthError | Error | unknown | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<{ full_name: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Add timeout to prevent hanging
          const rolePromise = fetchUserRole(session.user.id);
          const timeoutPromise = new Promise(resolve => setTimeout(resolve, 2000));
          await Promise.race([rolePromise, timeoutPromise]);
        } else {
          setUserRole(null);
          setProfile(null);
        }
        
        setLoading(false);
      }
    );

    // Check for existing session
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Add timeout to prevent infinite loading
          const rolePromise = fetchUserRole(session.user.id);
          const timeoutPromise = new Promise(resolve => setTimeout(resolve, 2000));
          
          await Promise.race([rolePromise, timeoutPromise]);
        }
      } catch (error) {
        console.error("Auth init error:", error);
      } finally {
        setLoading(false);
        setIsInitialized(true);
      }
    };

    initAuth();

    // Safety timeout: Force loading to false after 3 seconds max
    const safetyTimeout = setTimeout(() => {
      setLoading(prev => {
        if (prev) {
          console.warn("Auth loading timed out, forcing render");
          setIsInitialized(true);
          return false;
        }
        return prev;
      });
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, []);

  const fetchUserRole = async (userId: string) => {
    try {
      // Run queries in parallel for better performance
      const [roleResult, profileResult] = await Promise.all([
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("full_name, role")
          .eq("id", userId)
          .maybeSingle()
      ]);

      const { data: roleData, error: roleError } = roleResult;
      const { data: profileData, error: profileError } = profileResult;
      
      // Determine role with priority: user_roles > profiles > null
      let determinedRole: AppRole | null = null;
      
      if (roleData && roleData.role) {
        determinedRole = roleData.role as AppRole;
      } else if (profileData && profileData.role) {
        determinedRole = profileData.role as AppRole;
      } else {
        // Log errors only if both queries failed
        if (roleError && profileError) {
          console.error("Failed to fetch user role:", { roleError, profileError });
        }
      }
      
      setUserRole(determinedRole);
      
      if (profileData) {
        setProfile(profileData);
      }
      
    } catch (error: unknown) {
      console.error("Unexpected error fetching user data:", error);
      setUserRole(null);
      setProfile(null);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      // Perform authentication
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        throw error;
      }
      
      // After successful login, check email verification and role
      if (data?.user) {
        const currentUser = data.user; // Use the user from login response directly
        
        // Get user role - run queries in parallel for speed
        let userRole: AppRole | null = null;
        
        try {
          const [supervisorResult, roleResult, profileResult] = await Promise.all([
            supabase.from("supervisors").select("supervisor_type").eq("user_id", data.user.id).maybeSingle(),
            supabase.from("user_roles").select("role").eq("user_id", data.user.id).maybeSingle(),
            supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle()
          ]);
          
          // Determine role with priority
          if (supervisorResult.data?.supervisor_type) {
            userRole = supervisorResult.data.supervisor_type as AppRole;
          } else if (roleResult.data?.role) {
            userRole = roleResult.data.role as AppRole;
          } else if (profileResult.data?.role) {
            userRole = profileResult.data.role as AppRole;
          }
        } catch {
          // Role detection failed - proceed without blocking
          console.warn("Role detection failed, proceeding with login");
        }
        
        // Email verification check - only for students and admins
        const isSupervisor = userRole === "school_supervisor" || userRole === "industry_supervisor";
        const requiresEmailVerification = !isSupervisor && (userRole === "student" || userRole === "admin");
        
        if (requiresEmailVerification && !currentUser.email_confirmed_at) {
          await supabase.auth.signOut();
          const verificationError = new Error("Please verify your email before logging in. Check your inbox for the verification code.");
          verificationError.name = "EmailNotConfirmed";
          throw verificationError;
        }
        
      }
      
      toast.success("Successfully signed in!");
      return { error: null };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to sign in";
      toast.error(errorMessage);
      return { error };
    }
  };

  const signUp = async (email: string, password: string, fullName: string, role: AppRole) => {
    try {
      const redirectUrl = `${window.location.origin}/email-verification`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
            role: role,
          }
        }
      });
      
      if (error) throw error;

      // Ensure profile and user_roles are created (fallback when backend isn't used)
      const { data: { user: createdUser } } = await supabase.auth.getUser();
      if (createdUser) {
        const userId = createdUser.id;
        // Upsert profile
        try {
          await supabase
            .from("profiles")
            .upsert({
              id: userId,
              full_name: fullName,
              role,
            });
        } catch {
          // Ignore profile upsert errors
        }

        // Upsert user role
        try {
          await supabase
            .from("user_roles")
            .upsert({
              user_id: userId,
              role,
            });
        } catch {
          // Ignore user role upsert errors
        }

        // If school supervisor, also ensure a supervisor record exists (minimal fields)
        // Industry supervisors are NOT system users - data only
        if (role === "school_supervisor") {
          try {
            await supabase
              .from("supervisors")
              .upsert({
                user_id: userId,
                name: fullName,
                email,
                supervisor_type: "school_supervisor",
              }, { onConflict: "user_id" });
          } catch {
            // Ignore supervisor upsert errors
          }
        }
      }
      
      toast.success("Account created! Please check your email to verify.");
      return { error: null };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create account";
      toast.error(errorMessage);
      return { error };
    }
  };

  const signOut = async () => {
    try {
      // Always clear local state first to ensure user sees logged-out UI
      setUser(null);
      setSession(null);
      setUserRole(null);
      setProfile(null);
      
      // Then attempt to clear the server-side session
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Supabase signOut error:", error);
        // Even if server signout fails, local state is cleared
      }
      
      toast.success("Successfully signed out");
      navigate("/");
    } catch (error: unknown) {
      // Still navigate to home even if there's an error
      // Local state is already cleared
      const errorMessage = error instanceof Error ? error.message : "Failed to sign out";
      console.error("SignOut error:", errorMessage);
      toast.success("Signed out locally");
      navigate("/");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        userRole,
        profile,
        loading,
        isInitialized,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
