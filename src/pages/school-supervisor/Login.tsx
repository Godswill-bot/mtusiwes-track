import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, AlertCircle } from "lucide-react";
import mtuLogo from "@/assets/mtu-logo.png";
import mountaintopImg from "@/assets/mountaintop.jpg";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SchoolSupervisorLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portalActive, setPortalActive] = useState(true);
  const [loginAttempted, setLoginAttempted] = useState(false);

  const { signIn, user, userRole, loading: authLoading, isInitialized } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loginAttempted && user && userRole === "school_supervisor" && isInitialized && !authLoading) {
      navigate("/supervisor/dashboard", { replace: true });
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
        const errorObj = result.error as { message?: string };
        setError(errorObj.message || "Invalid email or password");
        toast.error(errorObj.message || "Failed to sign in");
      } else {
        setLoginAttempted(true);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(errorMessage);
      toast.error(errorMessage);
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
                &ldquo;Empowering supervisors to accurately track and validate student progress in their professional development journey.&rdquo;
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
                  School Supervisor Login
                </h1>
                <p className="text-sm text-muted-foreground">
                  MTU SIWES Logbook
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
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="supervisor@mtu.edu.ng" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>{loading ? "Signing in..." : "Sign In"}</Button>
              </form>

              <div className="mt-4 text-center space-y-2">
                <p className="text-sm text-muted-foreground">Don't have an account?{" "}<Button variant="link" className="p-0 h-auto" onClick={() => navigate("/school-supervisor/signup")}>Sign up here</Button></p>
                <p className="text-sm text-muted-foreground"><Button variant="link" className="p-0 h-auto" onClick={() => navigate("/forgot-password")}>Forgot Password?</Button></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchoolSupervisorLogin;
