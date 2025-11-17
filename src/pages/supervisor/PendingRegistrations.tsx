import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, UserPlus, Eye } from "lucide-react";

interface Student {
  id: string;
  matric_no: string;
  department: string;
  faculty: string;
  organisation_name: string;
  industry_supervisor_name: string;
  industry_supervisor_email: string;
  industry_supervisor_phone: string;
  email: string;
  phone: string;
  created_at: string;
}

const PendingRegistrations = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  useEffect(() => {
    fetchPendingStudents();
  }, [user, profile]);

  const fetchPendingStudents = async () => {
    try {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("school_supervisor_name", profile?.full_name || "")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setStudents(data || []);
    } catch (error: any) {
      toast.error("Failed to load student registrations");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const generatePassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const createIndustrySupervisorAccount = async (student: Student) => {
    setCreatingAccount(true);
    try {
      const tempPassword = generatePassword();

      // Call edge function to create supervisor account
      const { data, error } = await supabase.functions.invoke('create-supervisor', {
        body: {
          email: student.industry_supervisor_email,
          name: student.industry_supervisor_name,
          phone: student.industry_supervisor_phone,
          password: tempPassword,
        },
      });

      if (error) throw error;

      toast.success(
        `Account created successfully!\n\nEmail: ${student.industry_supervisor_email}\nPassword: ${tempPassword}\n\nPlease send these credentials to the supervisor.`,
        { duration: 10000 }
      );

      // Copy credentials to clipboard
      navigator.clipboard.writeText(
        `MTU SIWES Supervisor Account\n\nEmail: ${student.industry_supervisor_email}\nPassword: ${tempPassword}\n\nLogin at: ${window.location.origin}/auth/supervisor`
      );

      toast.info("Credentials copied to clipboard!");
      setSelectedStudent(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to create supervisor account");
      console.error(error);
    } finally {
      setCreatingAccount(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-light">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/supervisor/school/dashboard")}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <Card className="shadow-elevated">
          <CardHeader>
            <CardTitle className="text-2xl">Student Registrations</CardTitle>
            <CardDescription>
              Review student registrations and create industry supervisor accounts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {students.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No student registrations found
                </p>
              ) : (
                students.map((student) => (
                  <Card key={student.id} className="shadow-card">
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Student</p>
                            <p className="font-medium">{student.matric_no}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Department</p>
                            <p className="font-medium">{student.department}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Organisation</p>
                            <p className="font-medium">{student.organisation_name}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Industry Supervisor</p>
                            <p className="font-medium">{student.industry_supervisor_name}</p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" onClick={() => setSelectedStudent(student)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Registration Details</DialogTitle>
                                <DialogDescription>
                                  Complete student registration information
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="grid md:grid-cols-2 gap-4">
                                  <div>
                                    <Label>Matric Number</Label>
                                    <p className="text-sm">{student.matric_no}</p>
                                  </div>
                                  <div>
                                    <Label>Department</Label>
                                    <p className="text-sm">{student.department}</p>
                                  </div>
                                  <div>
                                    <Label>Faculty</Label>
                                    <p className="text-sm">{student.faculty}</p>
                                  </div>
                                  <div>
                                    <Label>Email</Label>
                                    <p className="text-sm">{student.email}</p>
                                  </div>
                                  <div>
                                    <Label>Phone</Label>
                                    <p className="text-sm">{student.phone}</p>
                                  </div>
                                  <div>
                                    <Label>Organisation</Label>
                                    <p className="text-sm">{student.organisation_name}</p>
                                  </div>
                                  <div className="col-span-2">
                                    <Label>Industry Supervisor Name</Label>
                                    <p className="text-sm">{student.industry_supervisor_name}</p>
                                  </div>
                                  <div>
                                    <Label>Supervisor Email</Label>
                                    <p className="text-sm">{student.industry_supervisor_email}</p>
                                  </div>
                                  <div>
                                    <Label>Supervisor Phone</Label>
                                    <p className="text-sm">{student.industry_supervisor_phone}</p>
                                  </div>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>

                          <Button
                            onClick={() => createIndustrySupervisorAccount(student)}
                            disabled={creatingAccount}
                          >
                            <UserPlus className="h-4 w-4 mr-2" />
                            {creatingAccount ? "Creating..." : "Create Supervisor Account"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default PendingRegistrations;
