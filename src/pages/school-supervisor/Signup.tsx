import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ArrowLeft, AlertCircle } from "lucide-react";
import mtuLogo from "@/assets/mtu-logo.png";
import mountaintopImg from "@/assets/mountaintop.jpg";
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
      try {
        const { data } = await supabase
          .from("portal_settings" as never)
          .select("student_portal_open")
          .eq("id", "1")
          .single();
        
        if (data) {
          setPortalActive((data as { student_portal_open?: boolean }).student_portal_open ?? true);
        }
      } catch {
        // Default to active if check fails
        setPortalActive(true);
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
      const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "" : "http://localhost:3001");
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
          const errorObj = result.error as { message?: string };
          throw new Error(errorObj.message || "Failed to create account");
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
          const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "" : "http://localhost:3001");
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
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-primary/10 to-success/5">
        <Card className="w-full max-w-md shadow-lg border">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <img src={mtuLogo} alt="MTU Logo" className="h-24 w-auto object-contain" />
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-primary/10 to-success/5 lg:p-8">
      <div className="flex w-full max-w-[1200px] lg:h-[85vh] flex-col lg:flex-row bg-card rounded-2xl shadow-xl overflow-hidden sm:min-h-[650px] border border-border">
        
        {/* Left Side - Image */}
        <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-zinc-900 p-10 text-white lg:flex">
          <div className="absolute inset-0 bg-zinc-900">
            <img 
              src={mountaintopImg} 
              className="h-full w-full object-cover opacity-50" 
              alt="Mountain Top" 
            />
          </div>
          <div className="relative z-20 flex items-center text-lg font-medium">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-2 h-6 w-6"
            >
              <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3 3" />
            </svg>
            MTU SIWES
          </div>
          <div className="relative z-20 mt-auto">
            <blockquote className="space-y-2">
              <p className="text-lg">
                &ldquo;Join our network of supervisors to guide and mentor the next generation of professionals.&rdquo;
              </p>
              <footer className="text-sm">MTU SIWES Unit - Supervisor Portal</footer>
            </blockquote>
          </div>
        </div>
        
        {/* Right Side - Form */}
        <div className="relative flex w-full flex-col lg:w-1/2 overflow-y-auto bg-card">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/")} 
            className="absolute left-4 top-4 md:left-8 md:top-8 z-10"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          <div className="flex min-h-full flex-col justify-center px-4 sm:px-8 md:px-12 lg:px-16 py-16 m-auto w-full">
            <div className="mx-auto flex w-full flex-col justify-center space-y-6 max-w-[400px]">
              <div className="flex flex-col space-y-2 text-center">
                <div className="flex justify-center mb-4">
                  <img src={mtuLogo} alt="MTU Logo" className="h-16 w-auto object-contain" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-card-foreground">
                  School Supervisor Sign Up
                </h1>
                <p className="text-sm text-muted-foreground">
                  Create your MTU SIWES supervisor account
                </p>
              </div>

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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchoolSupervisorSignup;

