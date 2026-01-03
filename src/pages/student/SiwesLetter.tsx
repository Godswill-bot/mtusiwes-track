import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, FileText, CheckCircle } from "lucide-react";

const SiwesLetter = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [letterGenerated, setLetterGenerated] = useState(false);
  const [studentInfo, setStudentInfo] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    checkLetterStatus();
  }, [checkLetterStatus]);

  const checkLetterStatus = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setStudentInfo(data);
        setLetterGenerated(data.siwes_letter_generated || false);
      }
    } catch (error) {
      console.error("Error checking letter status:", error);
    }
  }, [user]);

  const handleGenerateLetter = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Check if student record exists
      const { data: existingStudent } = await supabase
        .from("students")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingStudent) {
        // Update existing record
        const { error } = await supabase
          .from("students")
          .update({
            siwes_letter_generated: true,
            siwes_letter_generated_at: new Date().toISOString(),
          })
          .eq("id", existingStudent.id);

        if (error) throw error;
      } else {
        // Create new student record with letter generated
        const { error } = await supabase
          .from("students")
          .insert({
            user_id: user.id,
            full_name: profile?.full_name || "",
            email: user.email || "",
            siwes_letter_generated: true,
            siwes_letter_generated_at: new Date().toISOString(),
          });

        if (error) throw error;
      }

      setLetterGenerated(true);
      toast.success("SIWES Letter generated successfully!");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to generate letter";
      toast.error(errorMessage);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-light">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/student/dashboard")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>

          <Card className="shadow-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-6 w-6" />
                SIWES Letter Generation
              </CardTitle>
              <CardDescription>
                Generate your SIWES letter to proceed with pre-registration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {letterGenerated ? (
                <>
                  <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <p className="text-green-800 font-medium">
                      SIWES Letter has been generated successfully!
                    </p>
                  </div>

                  <div className="border rounded-lg p-6 bg-white">
                    <h3 className="font-semibold mb-4">Student Information</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Full Name</p>
                        <p className="font-medium">{profile?.full_name || studentInfo?.full_name || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Email</p>
                        <p className="font-medium">{user?.email || "N/A"}</p>
                      </div>
                      {studentInfo?.matric_no && (
                        <div>
                          <p className="text-muted-foreground">Matric Number</p>
                          <p className="font-medium">{studentInfo.matric_no}</p>
                        </div>
                      )}
                      {studentInfo?.department && (
                        <div>
                          <p className="text-muted-foreground">Department</p>
                          <p className="font-medium">{studentInfo.department}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border rounded-lg p-6 bg-gray-50">
                    <h3 className="font-semibold mb-4">SIWES Letter Content</h3>
                    <p className="text-sm text-muted-foreground italic">
                      Letter content will be added here by the administrator.
                    </p>
                  </div>

                  <Button
                    onClick={() => navigate("/student/pre-siwes")}
                    className="w-full"
                    size="lg"
                  >
                    Proceed to Pre-Registration Form
                  </Button>
                </>
              ) : (
                <>
                  <div className="space-y-4">
                    <p className="text-muted-foreground">
                      Click the button below to generate your SIWES letter. This letter is required before you can proceed with pre-registration.
                    </p>

                    {studentInfo && (
                      <div className="border rounded-lg p-4 bg-muted/50">
                        <h4 className="font-semibold mb-2">Your Information</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Name: </span>
                            <span className="font-medium">{profile?.full_name || studentInfo.full_name}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Email: </span>
                            <span className="font-medium">{user?.email}</span>
                          </div>
                          {studentInfo.matric_no && (
                            <div>
                              <span className="text-muted-foreground">Matric: </span>
                              <span className="font-medium">{studentInfo.matric_no}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <Button
                      onClick={handleGenerateLetter}
                      disabled={loading}
                      className="w-full"
                      size="lg"
                    >
                      {loading ? "Generating..." : "Generate SIWES Letter"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default SiwesLetter;

