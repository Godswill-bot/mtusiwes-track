import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, AlertCircle } from "lucide-react";
import mtuLogo from "@/assets/mtu-logo.png";
import siwesStudents from "@/assets/siwes-students.webp";
import itfBuilding from "@/assets/itf-building.png";
import studentLogbook from "@/assets/student-logbook.jpg";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Slideshow images array
const slideshowImages = [siwesStudents, itfBuilding, studentLogbook];

const SchoolSupervisorLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portalActive, setPortalActive] = useState(true);
  const [loginAttempted, setLoginAttempted] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  // Slideshow auto-advancement
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slideshowImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const { signIn, user, userRole, loading: authLoading, isInitialized } = useAuth();
  const navigate = useNavigate();

  // Redirect to dashboard after successful login when auth state is updated
  useEffect(() => {
    if (loginAttempted && user && userRole === "school_supervisor" && isInitialized && !authLoading) {
      navigate("/supervisor/dashboard", { replace: true });
    }
  }, [loginAttempted, user, userRole, isInitialized, authLoading, navigate]);

  useEffect(() => {
    // Check portal status in background - don't block login form
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

  // Note: We intentionally do NOT auto-redirect logged-in users here.
  // If a user navigates to /school-supervisor/login, they want to see the login form.
  // They might want to log out first or log in as a different user.
  // The homepage (Index.tsx) handles redirecting authenticated users to their dashboard.

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!portalActive) {
      setError("SIWES Portal is currently closed. Please contact the administrator.");
      return;
    }

    setLoading(true);

    try {
      // AuthContext.signIn() handles supervisor email verification bypass
      const result = await signIn(email, password);
      if (result.error) {
        const errorObj = result.error as { message?: string };
        setError(errorObj.message || "Invalid email or password");
        toast.error(errorObj.message || "Failed to sign in");
      } else {
        // Login successful - set flag and let useEffect handle navigation
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
      <div className="min-h-screen relative flex items-center justify-center p-4">
        {/* Slideshow Background */}
        {slideshowImages.map((image, index) => (
          <div
            key={index}
            className={`absolute inset-0 bg-cover bg-center bg-no-repeat blur-sm scale-105 transition-opacity duration-1000 ease-in-out ${
              index === currentSlide ? "opacity-100" : "opacity-0"
            }`}
            style={{ backgroundImage: `url(${image})` }}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/70 via-primary/50 to-black/60" />
        
        <Card className="w-full max-w-md shadow-elevated relative z-10 bg-white/30 backdrop-blur-md border-white/20">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <img src={mtuLogo} alt="MTU Logo" className="h-20 w-20 drop-shadow-lg" />
            </div>
            <CardTitle className="text-2xl font-bold text-white">SIWES Portal Closed</CardTitle>
            <CardDescription className="text-white/80">
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
    <div className="min-h-screen relative flex items-center justify-center p-4">
      {/* Slideshow Background */}
      {slideshowImages.map((image, index) => (
        <div
          key={index}
          className={`absolute inset-0 bg-cover bg-center bg-no-repeat blur-sm scale-105 transition-opacity duration-1000 ease-in-out ${
            index === currentSlide ? "opacity-100" : "opacity-0"
          }`}
          style={{ backgroundImage: `url(${image})` }}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/70 via-primary/50 to-black/60" />
      
      <Card className="w-full max-w-md shadow-elevated relative z-10 bg-white/30 backdrop-blur-md border-white/20">
        <CardHeader className="text-center space-y-4 relative">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="absolute top-4 left-4 text-white hover:bg-white/20"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex justify-center">
            <img src={mtuLogo} alt="MTU Logo" className="h-20 w-20 drop-shadow-lg" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-white">School Supervisor Login</CardTitle>
            <CardDescription className="text-white/80">MTU SIWES Logbook</CardDescription>
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
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="supervisor@mtu.edu.ng"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
          <div className="mt-4 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Button
                variant="link"
                className="p-0 h-auto"
                onClick={() => navigate("/school-supervisor/signup")}
              >
                Sign up here
              </Button>
            </p>
            <p className="text-sm text-muted-foreground">
              <Button
                variant="link"
                className="p-0 h-auto"
                onClick={() => navigate("/forgot-password")}
              >
                Forgot Password?
              </Button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SchoolSupervisorLogin;

