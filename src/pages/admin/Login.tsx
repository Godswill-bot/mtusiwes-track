import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, AlertCircle, Shield } from "lucide-react";
import mtuLogo from "@/assets/mtu-logo.png";
import { Alert, AlertDescription } from "@/components/ui/alert";

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginAttempted, setLoginAttempted] = useState(false);

  const { signIn, user, userRole, loading: authLoading, isInitialized } = useAuth();
  const navigate = useNavigate();

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
    <div className="min-h-screen flex items-center justify-center p-4 bg-white">
      <Card className="w-full max-w-md shadow-lg border">
        <CardHeader className="text-center space-y-4 relative">
          <Button variant="ghost" onClick={() => navigate("/")} className="absolute top-4 left-4">
            <ArrowLeft className="h-4 w-4 mr-2" />Back
          </Button>
          <div className="flex justify-center pt-6">
            <img src={mtuLogo} alt="MTU Logo" className="h-24 w-auto object-contain" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2 text-gray-900">
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
              <Input id="email" type="email" placeholder="admin@mtu.edu.ng" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} />
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
