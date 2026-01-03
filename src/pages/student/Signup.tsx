import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, AlertCircle } from "lucide-react";
import mtuLogo from "@/assets/mtu-logo.png";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const CBAS_DEPARTMENTS = [
  "Computer Science",
  "Software Engineering",
  "Cybersecurity",
  "Microbiology",
  "Biology",
  "Biochemistry",
  "Biotechnology",
  "Chemistry"
];

const CHMS_DEPARTMENTS = [
  "Mass Communication",
  "Fine Art"
];

const StudentSignup = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [matricNo, setMatricNo] = useState("");
  const [faculty, setFaculty] = useState<"CBAS" | "CHMS" | "">("");
  const [department, setDepartment] = useState("");
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
    if (user && userRole === "student") {
      navigate("/student/dashboard");
    } else if (user && userRole) {
      navigate("/");
    }
  }, [user, userRole, navigate]);

  const validateMTUEmail = (email: string): boolean => {
    const mtuEmailRegex = /^[a-zA-Z0-9]+@mtu\.edu\.ng$/;
    return mtuEmailRegex.test(email);
  };

  const validateMatricNo = (matric: string): boolean => {
    // Format: e.g., 22010306034 (11 digits)
    const matricRegex = /^\d{11}$/;
    return matricRegex.test(matric);
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

    // Validate matric number
    if (!validateMatricNo(matricNo)) {
      setError("Matric number must be 11 digits (e.g., 22010306034)");
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

    if (!faculty || !department) {
      setError("Please select faculty and department");
      return;
    }

    setLoading(true);

    try {
      // Try backend API first (for OTP email verification)
      const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
      let useBackend = false;
      let userId: string | null = null;

      try {
        // Extract firstname and lastname from fullName
        const nameParts = fullName.trim().split(" ");
        const firstname = nameParts[0] || "";
        const lastname = nameParts.slice(1).join(" ") || "";

        const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            firstname,
            lastname,
            matricNumber: matricNo,
            email,
            password,
            phone,
            faculty,
            department,
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
        const result = await signUp(email, password, fullName, "student");
        if (result.error) {
          throw new Error(result.error.message || "Failed to create account");
        }

        // Wait a moment for user to be created
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Get the current user
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        userId = currentUser?.id || null;
      }

      // Store additional student info in students table (only if backend didn't create it)
      if (userId && !useBackend) {
        // First check if student record exists
        const { data: existingStudent } = await supabase
          .from("students")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();

        if (existingStudent) {
          // Update existing record with available data
          const { error: studentError } = await supabase
            .from("students")
            .update({
              full_name: fullName,
              matric_no: matricNo,
              faculty: faculty,
              department: department,
              phone: phone,
            })
            .eq("user_id", userId);

          if (studentError) {
            console.error("Error updating student info:", studentError);
            toast.warning("Account created but student profile update failed. Please contact support.");
          }
        } else {
          // Try to insert new record (may fail if required fields are missing)
          // This is a fallback - ideally backend should create it
          const { error: studentError, data: insertedStudent } = await supabase
            .from("students")
            .insert({
              user_id: userId,
              full_name: fullName,
              email: email,
              matric_no: matricNo,
              faculty: faculty || 'TBD',
              department: department || 'TBD',
              phone: phone || '',
              // Required fields with placeholder values
              organisation_name: 'To be updated',
              organisation_address: 'To be updated',
              nature_of_business: 'To be updated',
              location_size: 'medium',
              products_services: 'To be updated',
              industry_supervisor_name: 'To be updated',
              period_of_training: 'To be updated',
            })
            .select("id")
            .single();

          if (studentError) {
            console.error("Error creating student record:", studentError);
            toast.warning("Account created but student profile creation failed. You can complete your profile later.");
          } else if (insertedStudent?.id) {
            // Automatically assign student to a random school supervisor
            try {
              const { error: assignmentError } = await supabase.rpc(
                "assign_student_to_school_supervisor",
                { p_student_id: insertedStudent.id }
              );

              if (assignmentError) {
                console.error("Error assigning supervisor:", assignmentError);
                // Don't block signup if assignment fails
              }
            } catch (assignmentErr) {
              console.error("Unexpected error during supervisor assignment:", assignmentErr);
              // Don't block signup
            }
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
              userType: "student",
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
        navigate(`/student/verify-email?email=${encodeURIComponent(email)}`);
      } else {
        toast.success("Account created! Please check your email to verify your account.");
        navigate("/student/login");
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(errorMessage);
      toast.error(errorMessage);
      console.error("Signup error:", err);
    } finally {
      setLoading(false);
    }
  };

  const getDepartmentOptions = () => {
    if (faculty === "CBAS") return CBAS_DEPARTMENTS;
    if (faculty === "CHMS") return CHMS_DEPARTMENTS;
    return [];
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
      <Card className="w-full max-w-2xl shadow-elevated max-h-[90vh] overflow-y-auto">
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
            <CardTitle className="text-2xl font-bold">Student Sign Up</CardTitle>
            <CardDescription>Create your MTU SIWES account</CardDescription>
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
                placeholder="John Doe"
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="matricNo">Matric Number *</Label>
                <Input
                  id="matricNo"
                  type="text"
                  placeholder="22010306034"
                  value={matricNo}
                  onChange={(e) => setMatricNo(e.target.value.replace(/\D/g, ""))}
                  required
                  maxLength={11}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">11 digits only</p>
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="faculty">Faculty *</Label>
                <Select value={faculty} onValueChange={(v) => { setFaculty(v as "CBAS" | "CHMS"); setDepartment(""); }} required disabled={loading}>
                  <SelectTrigger id="faculty">
                    <SelectValue placeholder="Select Faculty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CBAS">CBAS</SelectItem>
                    <SelectItem value="CHMS">CHMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">Department *</Label>
                <Select value={department} onValueChange={setDepartment} required disabled={loading || !faculty}>
                  <SelectTrigger id="department">
                    <SelectValue placeholder="Select Department" />
                  </SelectTrigger>
                  <SelectContent>
                    {getDepartmentOptions().map((dept) => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                onClick={() => navigate("/student/login")}
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

export default StudentSignup;
