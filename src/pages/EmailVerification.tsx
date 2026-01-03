import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import mtuLogo from "@/assets/mtu-logo.png";
import { Alert, AlertDescription } from "@/components/ui/alert";

const EmailVerification = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get("token");
      const type = searchParams.get("type");

      if (type === "signup" && token) {
        try {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: "signup",
          });

          if (error) throw error;

          if (data.user) {
            // Fetch user role from profiles
            const { data: profileData, error: profileError } = await supabase
              .from("profiles")
              .select("role")
              .eq("id", data.user.id)
              .maybeSingle();

            if (profileError) {
              console.error("Error fetching profile:", profileError);
            }

            const role = profileData?.role || null;
            setUserRole(role);

            if (role === "student") {
              setMessage("Email verified successfully! You can now proceed to generate your SIWES letter.");
            } else if (role === "school_supervisor") {
              setMessage("Email verified successfully! You can now log in to your supervisor dashboard.");
            } else {
              setMessage("Email verified successfully!");
            }

            setStatus("success");
          }
        } catch (error: unknown) {
          setStatus("error");
          const errorMessage = error instanceof Error ? error.message : "Failed to verify email. Please try again.";
          setMessage(errorMessage);
        }
      } else {
        setStatus("error");
        setMessage("Invalid verification link.");
      }
    };

    verifyEmail();
  }, [searchParams]);

  const handleContinue = () => {
    if (userRole === "student") {
      navigate("/student/siwes-letter");
    } else if (userRole === "school_supervisor") {
      navigate("/school-supervisor/login");
    } else {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-light flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-elevated">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img src={mtuLogo} alt="MTU Logo" className="h-20 w-20" />
          </div>
          <CardTitle className="text-2xl font-bold">Email Verification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "loading" && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Verifying your email...</p>
            </div>
          )}

          {status === "success" && (
            <>
              <Alert className="border-green-500 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  {message}
                </AlertDescription>
              </Alert>
              <Button onClick={handleContinue} className="w-full" size="lg">
                {userRole === "student" 
                  ? "Continue to SIWES Letter" 
                  : userRole === "school_supervisor"
                  ? "Continue to Login"
                  : "Continue"}
              </Button>
            </>
          )}

          {status === "error" && (
            <>
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{message}</AlertDescription>
              </Alert>
              <div className="flex gap-2">
                <Button 
                  onClick={() => navigate("/student/login")} 
                  className="flex-1" 
                  variant="outline"
                >
                  Student Login
                </Button>
                <Button 
                  onClick={() => navigate("/school-supervisor/login")} 
                  className="flex-1" 
                  variant="outline"
                >
                  Supervisor Login
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailVerification;

