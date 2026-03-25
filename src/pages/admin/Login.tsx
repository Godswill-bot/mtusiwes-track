import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, AlertCircle, Shield, Eye, EyeOff } from "lucide-react";
import mtuLogo from "@/assets/mtu-logo.png";
import { Alert, AlertDescription } from "@/components/ui/alert";

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginAttempted, setLoginAttempted] = useState(false);

  const { signIn, user, userRole, loading: authLoading, isInitialized } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const isAuthorizedUrl = searchParams.get("access") === "mtu_admin_secure";

  if (!isAuthorizedUrl) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4">
        <Shield className="h-24 w-24 text-red-500 mb-6" />
        <h1 className="text-4xl font-bold mb-4 tracking-tight">Access Denied</h1>
        <p className="text-lg text-muted-foreground mb-8 text-center max-w-md">
          This portal is restricted to authorized administrative personnel. 
        </p>
        <Button variant="outline" size="lg" onClick={() => navigate("/")}>
          Return to Portal
        </Button>
      </div>
    );
  }

  useEffect(() => {
    if (loginAttempted && user && userRole === "admin" && isInitialized && !authLoading) {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [loginAttempted, user, userRole, isInitialized, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await signIn(email, password);
      if (result.error) {
        const errorMsg = typeof result.error === "object" && result.error !== null && "message" in result.error
          ? (result.error as { message: string }).message
          : "Failed to sign in";
        setError(errorMsg);
      } else {
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-primary/10 to-success/5">
      <Card className="w-full max-w-md shadow-lg border">
        <CardHeader className="text-center space-y-4 relative">
          <Button variant="ghost" onClick={() => navigate("/")} className="absolute top-4 left-4">
            <ArrowLeft className="h-4 w-4 mr-2" />Back
          </Button>
          <div className="flex justify-center pt-6">
            <img src={mtuLogo} alt="MTU Logo" className="h-24 w-auto object-contain" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2 text-card-foreground">
              <Shield className="h-6 w-6" />Admin Login
            </CardTitle>
            <CardDescription>MTU SIWES System Administration</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {error && (<Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>)}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input 
                    id="password" 
                    type={showPassword ? "text" : "password"} 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required 
                    disabled={loading} 
                    className="pr-10" 
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Signing in..." : "Sign In"}</Button>
          </form>
          <p className="text-sm text-muted-foreground text-center mt-4">Admin accounts are created manually by system administrators</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogin;
