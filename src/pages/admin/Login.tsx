import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, AlertCircle, Shield } from "lucide-react";
import mtuLogo from "@/assets/mtu-logo.png";
import siwesStudents from "@/assets/siwes-students.webp";
import itfBuilding from "@/assets/itf-building.png";
import studentLogbook from "@/assets/student-logbook.jpg";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Slideshow images array
const slideshowImages = [siwesStudents, itfBuilding, studentLogbook];

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginAttempted, setLoginAttempted] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  const { signIn, user, userRole, loading: authLoading, isInitialized } = useAuth();
  const navigate = useNavigate();

  // Slideshow auto-advancement
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slideshowImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Redirect to dashboard after successful login when auth state is updated
  useEffect(() => {
    if (loginAttempted && user && userRole === "admin" && isInitialized && !authLoading) {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [loginAttempted, user, userRole, isInitialized, authLoading, navigate]);

  // Note: We intentionally do NOT auto-redirect logged-in users here.
  // If a user navigates to /admin/login, they want to see the login form.
  // They might want to log out first or log in as a different user.
  // The homepage (Index.tsx) handles redirecting authenticated users to their dashboard.

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signIn(email, password);
      if (result.error) {
        const errorMsg = typeof result.error === 'object' && result.error !== null && 'message' in result.error 
          ? (result.error as { message: string }).message 
          : "Failed to sign in";
        setError(errorMsg);
      } else {
        // Login successful - set flag and let useEffect handle navigation
        setLoginAttempted(true);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
      if (errorMessage.toLowerCase().includes("failed to fetch") || errorMessage.toLowerCase().includes("network")) {
        setError("Network error. Please check your internet connection and try again.");
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

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
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/80 via-purple-900/60 to-black/70" />
      
      {/* Decorative Shield Watermark */}
      <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
        <Shield className="w-96 h-96 text-white" />
      </div>
      
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
            <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2 text-white">
              <Shield className="h-6 w-6 text-white" />
              Admin Login
            </CardTitle>
            <CardDescription className="text-white/80">MTU SIWES System Administration</CardDescription>
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
              <Label htmlFor="email" className="text-white">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@mtu.edu.ng"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="bg-white/80"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="bg-white/80"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
          <p className="text-sm text-white/80 text-center mt-4">
            Admin accounts are created manually by system administrators
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogin;

