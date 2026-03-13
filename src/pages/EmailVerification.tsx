import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      try {
        // Wait a slight moment to see if Supabase naturally caught the session from URL
        const { data: { session } } = await supabase.auth.getSession();
        let currentUser = session?.user;

        // Parse hash fragment manually since Supabase implicit flow puts tokens there
        const hash = window.location.hash.substring(1);
        const hashParams = new URLSearchParams(hash);
        
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const errorDesc = hashParams.get("error_description");

        const tokenQuery = searchParams.get("token");
        const typeQuery = searchParams.get("type");

        if (errorDesc) {
          throw new Error(errorDesc.replace(/\+/g, ' '));
        }

        // If not automatically logged in but we have tokens in the hash
        if (!currentUser && accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          if (error) throw error;
          currentUser = data.user;
        }

        // Fallback for explicit query parameters (OTP link)
        if (!currentUser && typeQuery === "signup" && tokenQuery) {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenQuery,
            type: "signup",
          });
          if (error) throw error;
          currentUser = data.user;
        }

        if (currentUser) {
          // Fetch user role
          const { data: profileData } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", currentUser.id)
            .maybeSingle();

          setUserRole(profileData?.role || null);
          setStatus("success");
        } else {
          // If we reach here, no valid tokens were found in hash or query
          throw new Error("Invalid or expired verification link.");
        }
      } catch (error: any) {
        setStatus("error");
        setMessage(error.message || "Failed to verify email. Please try again.");
      }
    };

    verifyEmail();
  }, [searchParams]);

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
                <AlertDescription className="text-green-800 font-medium">
                  Verified successfully! Please click the option below to continue.
                </AlertDescription>
              </Alert>
              
              <div className="mt-6 flex flex-col gap-3">
                {userRole === "student" && (
                  <Button 
                    onClick={() => navigate("/student/login")} 
                    className="w-full" 
                    size="lg"
                  >
                    Student Login
                  </Button>
                )}
                
                {userRole === "school_supervisor" && (
                  <Button 
                    onClick={() => navigate("/school-supervisor/login")} 
                    className="w-full" 
                    size="lg"
                  >
                    Supervisor Login
                  </Button>
                )}

                {(!userRole || (userRole !== "student" && userRole !== "school_supervisor")) && (
                  <Button onClick={() => navigate("/")} className="w-full" size="lg">
                    Continue to Home
                  </Button>
                )}
              </div>
            </>
          )}

          {status === "error" && (
            <>
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{message}</AlertDescription>
              </Alert>
              <div className="flex gap-2 mt-4">
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

