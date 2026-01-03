import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, AlertCircle } from "lucide-react";
import mtuLogo from "@/assets/mtu-logo.png";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SchoolSupervisorSignup = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portalActive, setPortalActive] = useState(true);

  const { signUp, user, userRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if portal is active
    const checkPortalStatus = async () => {
      const { data } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "portal_active")
        .single();
      
      if (data?.value === false || data?.value === "false") {
        setPortalActive(false);
      }
    };
    checkPortalStatus();
  }, []);

  useEffect(() => {
    if (user && userRole === "school_supervisor") {
      navigate("/supervisor/school/dashboard");
    } else if (user && userRole) {
      navigate("/");
    }
  }, [user, userRole, navigate]);

  const validateMTUEmail = (email: string): boolean => {
    const mtuEmailRegex = /^[a-zA-Z0-9]+@mtu\.edu\.ng$/;
    return mtuEmailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!portalActive) {
      setError("SIWES Portal is currently closed. Please contact the administrator.");
      return;
    }

    // Validate MTU email
    if (!validateMTUEmail(email)) {
      setError("Please use a valid MTU email address (format: firstnamelastname@mtu.edu.ng)");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      // Extract firstname and lastname from fullName
      const nameParts = fullName.trim().split(" ");
      const firstname = nameParts[0] || "";
      const lastname = nameParts.slice(1).join(" ") || "";

      // Try backend API first (for OTP email verification)
      const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
      let useBackend = false;
      let userId: string | null = null;

      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            firstname,
            lastname,
            email,
            password,
            phone,
            role: "school_supervisor",
          }),
        });

        if (response.ok) {
          const data = await response.json();
          userId = data.userId;
          useBackend = true;
        } else {
          // Backend returned error, fall through to Supabase Auth
          const errorText = await response.text();
          console.warn("Backend registration failed, using Supabase Auth:", errorText);
        }
      } catch (fetchError: unknown) {
        // Backend server not available, use Supabase Auth directly
        const errorMessage = fetchError instanceof Error ? fetchError.message : "Unknown error";
        console.warn("Backend server not available, using Supabase Auth:", errorMessage);
      }

      // If backend didn't work, use Supabase Auth directly
      if (!useBackend) {
        const result = await signUp(email, password, fullName, "school_supervisor");
        if (result.error) {
          throw new Error(result.error.message || "Failed to create account");
        }

        // Wait a moment for user to be created
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Get the current user
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        userId = currentUser?.id || null;
      }

      // Store additional supervisor info in supervisors table (only if backend didn't create it)
      if (userId && !useBackend) {
        // Check if supervisor record already exists
        const { data: existingSupervisor } = await supabase
          .from("supervisors")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();

        if (existingSupervisor) {
          // Update existing record
          const { error: supervisorError } = await supabase
            .from("supervisors")
            .update({
              name: fullName,
              email: email,
              phone: phone,
              supervisor_type: "school_supervisor",
            })
            .eq("user_id", userId);

          if (supervisorError) {
            console.error("Error updating supervisor info:", supervisorError);
            toast.warning("Account created but supervisor profile update failed. Please contact support.");
          }
        } else {
          // Insert new record
          const { error: supervisorError } = await supabase
            .from("supervisors")
            .insert({
              user_id: userId,
              name: fullName,
              email: email,
              phone: phone,
              supervisor_type: "school_supervisor",
            });

          if (supervisorError) {
            console.error("Error creating supervisor record:", supervisorError);
            toast.warning("Account created but supervisor profile creation failed. Please contact support.");
          }
        }
      }

      // Log signup activity (registration is already logged by backend)
      if (!useBackend && userId) {
        try {
          const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
          await fetch(`${API_BASE_URL}/api/auth/log-activity`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: userId,
              userType: "school_supervisor",
              userEmail: email,
              activityType: "signup",
              success: true,
            }),
          }).catch(() => {}); // Don't block on logging failure
        } catch (logError) {
          // Ignore logging errors
        }
      }

      if (useBackend) {
        toast.success("Account created! Please check your email for the verification code.");
        navigate(`/school-supervisor/verify-email?email=${encodeURIComponent(email)}`);
      } else {
        toast.success("Account created! Please check your email to verify your account.");
        navigate("/school-supervisor/login");
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(errorMessage);
      toast.error(errorMessage);
      console.error("Supervisor signup error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!portalActive) {
    return (
      <div className="min-h-screen bg-gradient-light flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-elevated">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <img src={mtuLogo} alt="MTU Logo" className="h-20 w-20" />
            </div>
            <CardTitle className="text-2xl font-bold">SIWES Portal Closed</CardTitle>
            <CardDescription>
              The SIWES Portal is currently closed. Please contact the administrator for assistance.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/")} className="w-full">
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-light flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-elevated">
        <CardHeader className="text-center space-y-4 relative">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="absolute top-4 left-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex justify-center">
            <img src={mtuLogo} alt="MTU Logo" className="h-20 w-20" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">School Supervisor Sign Up</CardTitle>
            <CardDescription>Create your MTU SIWES supervisor account</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Dr. John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">MTU Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="firstnamelastname@mtu.edu.ng"
                value={email}
                onChange={(e) => setEmail(e.target.value.toLowerCase())}
                required
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Only MTU email addresses are accepted (format: firstnamelastname@mtu.edu.ng)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+234 xxx xxx xxxx"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Must be at least 6 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password *</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Create Account"}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Button
                variant="link"
                className="p-0 h-auto"
                onClick={() => navigate("/school-supervisor/login")}
              >
                Sign in here
              </Button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SchoolSupervisorSignup;

