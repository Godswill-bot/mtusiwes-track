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
import { AuthSlideshow } from "@/components/auth/AuthSlideshow";

const StudentLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portalActive, setPortalActive] = useState<boolean | null>(null);
  const [loginAttempted, setLoginAttempted] = useState(false);

  const { signIn, user, userRole, loading: authLoading, isInitialized } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loginAttempted && user && userRole === "student" && isInitialized && !authLoading) {
      navigate("/student/dashboard", { replace: true });
    }
  }, [loginAttempted, user, userRole, isInitialized, authLoading, navigate]);

  useEffect(() => {
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
        setPortalActive(true);
      }
    };
    checkPortalStatus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!portalActive) {
      setError("SIWES Portal is currently closed. Please contact the administrator.");
      return;
    }
    setLoading(true);
    try {
      const result = await signIn(email, password);
      if (result.error) {
        const errorObj = result.error as { message?: string; name?: string };
        if (errorObj.message?.includes("verify") || errorObj.name === "EmailNotConfirmed" || errorObj.message?.includes("Email not confirmed")) {
          setError("Please verify your email before logging in. Check your inbox for the verification code.");
          toast.error("Email verification required");
        } else {
          setError(errorObj.message || "Invalid email or password");
          toast.error(errorObj.message || "Failed to sign in");
        }
      } else {
        setLoginAttempted(true);
      }
    } catch (err: unknown) {
      const isEmailError = err instanceof Error && (err.name === "EmailNotConfirmed" || err.message.includes("verify"));
      if (isEmailError) {
        setError("Please verify your email before logging in. Check your inbox for the verification code.");
        toast.error("Email verification required");
      } else {
        const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  if (portalActive === null) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!portalActive) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-primary/10 to-success/5">
        <Card className="w-full max-w-md shadow-lg border">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <img src={mtuLogo} alt="MTU Logo" className="h-24 w-auto object-contain" />
            </div>
            <CardTitle className="text-2xl font-bold text-card-foreground">SIWES Portal Closed</CardTitle>
            <CardDescription>The SIWES Portal is currently closed. Please contact the administrator for assistance.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/")} className="w-full">Return to Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 lg:p-8 bg-gradient-to-br from-primary/5 via-primary/10 to-success/5">
      <div className="flex w-full max-w-[1200px] lg:h-[85vh] flex-col lg:flex-row bg-card rounded-2xl shadow-xl overflow-hidden sm:min-h-[650px] border border-border relative">
        {/* Slideshow Pane */}
        <AuthSlideshow />

        {/* Form Pane */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-6 lg:p-10 overflow-y-auto no-scrollbar">
          <div className="w-full max-w-md my-auto py-8">
          <div className="mb-8 relative">
            <Button
              variant="ghost"
              onClick={() => navigate("/")}
              className="absolute -top-4 -left-2 text-muted-foreground hover:text-card-foreground z-10"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex justify-center mb-6 mt-4">
              <img src={mtuLogo} alt="MTU Logo" className="h-24 w-auto object-contain" />
            </div>
            <div className="text-center">
              <h1 className="text-3xl font-bold text-card-foreground">Student Login</h1>
              <p className="text-muted-foreground mt-2">Access your MTU SIWES dashboard</p>
            </div>
          </div>

          <div className="bg-card/50 backdrop-blur-sm">
            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="student@mtu.edu.ng"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <Label htmlFor="password">Password</Label>
                  </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11"
                />
              </div>
              <Button type="submit" className="w-full h-12 text-lg font-medium mt-6" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
            <div className="mt-8 text-center pb-8 border-t pt-6 flex flex-col items-center gap-2">
                <p className="text-muted-foreground">
                  Don't have an account?{" "}
                  <Button variant="link" className="p-0 h-auto font-semibold text-primary hover:text-primary/80" onClick={() => navigate("/student/signup")}>
                    Sign up here
                  </Button>
                </p>
                <div className="mt-2">
                  <Button variant="link" className="p-0 h-auto text-sm text-foreground hover:text-primary transition-colors" onClick={(e) => { e.preventDefault(); navigate("/forgot-password"); }}>
                    Forgot Password?
                  </Button>
                </div>
              </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
};

export default StudentLogin;

