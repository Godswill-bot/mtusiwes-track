import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { AlertCircle, User, Building, Loader2 } from "lucide-react";
import { FadeIn } from "@/components/animations/MotionWrappers";

interface StudentInfo {
  id: string;
  matric_no: string;
  full_name: string;
  department: string;
  faculty: string;
  email: string;
  phone: string;
}

const fetchStudentByMatric = async (matricNo: string) => {
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .eq("matric_no", matricNo.toUpperCase().trim())
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

const fetchCurrentSession = async () => {
  const { data, error } = await supabase
    .from("academic_sessions")
    .select("*")
    .eq("is_current", true)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

const updateStudentPlacement = async ({
  studentId,
  sessionId,
  organisationName,
  organisationAddress,
}: {
  studentId: string;
  sessionId: string;
  organisationName: string;
  organisationAddress: string;
}) => {
  // Insert or update placement
  const { error: placementError } = await supabase
    .from("student_placements")
    .upsert(
      {
        student_id: studentId,
        session_id: sessionId,
        organisation_name: organisationName,
        organisation_address: organisationAddress,
        placement_date: new Date().toISOString(),
      },
      {
        onConflict: "student_id,session_id",
      }
    );

  if (placementError) throw placementError;

  // Also update students table placement info - use organisation fields that exist in schema
  const { error: studentError } = await supabase
    .from("students")
    .update({
      organisation_name: organisationName,
      organisation_address: organisationAddress,
    })
    .eq("id", studentId);

  if (studentError) throw studentError;
};

export const StudentPlacement = () => {
  const queryClient = useQueryClient();
  const [matricNo, setMatricNo] = useState("");
  const [organisationName, setOrganisationName] = useState("");
  const [organisationAddress, setOrganisationAddress] = useState("");
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);

  const { data: currentSession, isPending: sessionPending } = useQuery({
    queryKey: ["current-session"],
    queryFn: fetchCurrentSession,
  });

  const mutation = useMutation({
    mutationFn: updateStudentPlacement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-placements"] });
      toast.success("Student placement updated successfully");
      setMatricNo("");
      setStudentInfo(null);
      setOrganisationName("");
      setOrganisationAddress("");
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Failed to update placement";
      toast.error(message);
    },
  });

  const handleMatricSearch = async () => {
    if (!matricNo.trim()) {
      toast.error("Please enter a matric number");
      return;
    }

    try {
      const student = await fetchStudentByMatric(matricNo);
      if (student) {
        setStudentInfo({
          id: student.id,
          matric_no: student.matric_no,
          full_name: student.full_name || "N/A",
          department: student.department,
          faculty: student.faculty,
          email: student.email,
          phone: student.phone,
        });
        
        // Pre-fill existing placement if any - use organisation fields
        if (student.organisation_name) {
          setOrganisationName(student.organisation_name);
        }
        if (student.organisation_address) {
          setOrganisationAddress(student.organisation_address);
        } else {
          // Default address
          setOrganisationAddress("Nasarawa State University, P.M.B 1022, Keffi, Nasarawa State");
        }
      } else {
        setStudentInfo(null);
        toast.error("Student not found with this matric number");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to fetch student information";
      toast.error(message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!studentInfo || !currentSession) {
      toast.error("Please search for a student first");
      return;
    }

    if (!organisationName.trim() || !organisationAddress.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    mutation.mutate({
      studentId: studentInfo.id,
      sessionId: currentSession.id,
      organisationName: organisationName.trim(),
      organisationAddress: organisationAddress.trim(),
    });
  };

  return (
    <FadeIn>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Student Placement
          </CardTitle>
          <CardDescription>
            Type in the Complete Student Matric No. and He/Her Information will be pulled automatically to the fields
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="matric">Matric Number</Label>
              <div className="flex gap-2">
                <Input
                  id="matric"
                  placeholder="Type Matric No. Here"
                  value={matricNo}
                  onChange={(e) => setMatricNo(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleMatricSearch();
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={handleMatricSearch}
                  disabled={!matricNo.trim()}
                >
                  Search
                </Button>
              </div>
            </div>

            {studentInfo && (
              <>
                <Alert>
                  <User className="h-4 w-4" />
                  <AlertDescription>
                    Student information found. Please review and update placement details below.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <Label className="text-xs text-muted-foreground">Name</Label>
                    <p className="font-medium">{studentInfo.full_name}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Level</Label>
                    <p className="font-medium">N/A</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Faculty</Label>
                    <p className="font-medium">{studentInfo.faculty}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Department</Label>
                    <p className="font-medium">{studentInfo.department}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="organisation">
                    Student Place of Placement <span className="text-destructive">REQUIRED</span>
                  </Label>
                  <Input
                    id="organisation"
                    value={organisationName}
                    onChange={(e) => setOrganisationName(e.target.value)}
                    placeholder="Organisation Name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Organisation Address</Label>
                  <Input
                    id="address"
                    value={organisationAddress}
                    onChange={(e) => setOrganisationAddress(e.target.value)}
                    placeholder="Full Organisation Address"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={mutation.isPending || sessionPending}
                >
                  {mutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Placement"
                  )}
                </Button>
              </>
            )}

            {!studentInfo && matricNo && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No student found with matric number: {matricNo}
                </AlertDescription>
              </Alert>
            )}
          </form>
        </CardContent>
      </Card>
    </FadeIn>
  );
};
















