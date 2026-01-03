import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, UserPlus, Eye, Check, X, Clock, CheckCircle, XCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

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
  pre_registration_approved?: boolean;
  pre_registration_approved_at?: string | null;
  school_supervisor_name?: string | null;
  school_supervisor_email?: string | null;
  other_info?: string | null;
}

interface PreRegistration {
  session_id: string;
  status: string;
  approved_at: string | null;
  remark: string | null;
}

interface StudentWithPreReg extends Student {
  pre_registration: PreRegistration[];
}

interface Assignment {
  student_id: string;
  student: StudentWithPreReg;
}

const PendingRegistrations = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [pendingStudents, setPendingStudents] = useState<Student[]>([]);
  const [approvedStudents, setApprovedStudents] = useState<Student[]>([]);
  const [rejectedStudents, setRejectedStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [studentToReject, setStudentToReject] = useState<Student | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");


  const fetchAllStudents = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // 1. Fetch Supervisor Info and Current Session in Parallel
      const [supervisorResult, sessionResult] = await Promise.all([
        supabase
          .from("supervisors")
          .select("id, email")
          .eq("user_id", user.id)
          .eq("supervisor_type", "school_supervisor")
          .maybeSingle(),
        supabase
          .from("academic_sessions")
          .select("id")
          .eq("is_current", true)
          .maybeSingle()
      ]);

      const supervisorRecord = supervisorResult.data;
      const currentSession = sessionResult.data;

      if (!supervisorRecord || !currentSession) {
        console.log("Missing supervisor record or current session");
        setLoading(false);
        return;
      }

      const supervisorId = supervisorRecord.id;
      const sessionId = currentSession.id;

      // 2. Fetch Assignments with Student Data and Pre-Registration in ONE query
      // This avoids the N+1 problem and reduces round trips
      const { data: assignments, error } = await supabase
        .from("supervisor_assignments")
        .select(`
          student_id,
          student:students (
            *,
            pre_registration (*)
          )
        `)
        .eq("supervisor_id", supervisorId)
        .eq("session_id", sessionId)
        .eq("assignment_type", "school_supervisor");

      if (error) throw error;

      // Categorize students by status
      const pending: Student[] = [];
      const approved: Student[] = [];
      const rejected: Student[] = [];

      (assignments as unknown as Assignment[])?.forEach((assignment) => {
        const studentData = assignment.student;
        if (!studentData) return;

        // Find the pre-registration for the current session
        // Since we fetched all pre-registrations for the student, we need to filter
        const preRegs = studentData.pre_registration || [];
        const currentPreReg = preRegs.find((pr) => pr.session_id === sessionId);

        if (!currentPreReg) return; // Skip if no pre-registration for this session

        // Merge student data with pre-registration status
        const student: Student = {
          ...studentData,
          // Map legacy fields for UI compatibility
          pre_registration_approved: currentPreReg.status === 'approved',
          pre_registration_approved_at: currentPreReg.approved_at,
          other_info: currentPreReg.remark ? `Rejected: ${currentPreReg.remark}` : studentData.other_info
        };

        if (currentPreReg.status === 'approved') {
          approved.push(student);
        } else if (currentPreReg.status === 'rejected') {
          rejected.push(student);
        } else {
          pending.push(student);
        }
      });

      setPendingStudents(pending);
      setApprovedStudents(approved);
      setRejectedStudents(rejected);
    } catch (error: unknown) {
      toast.error("Failed to load student registrations");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAllStudents();
  }, [user, profile, fetchAllStudents]);

  const generatePassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  // Note: Industry supervisors no longer have login accounts
  // This function is kept for reference but should not be used
  // School supervisors manage industry supervisor tasks manually
  const createIndustrySupervisorAccount = async (student: Student) => {
    toast.info("Industry supervisors no longer have login accounts. School supervisors manage their tasks manually.");
    return;
    
    // Legacy code (disabled):
    /*
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create supervisor account";
      toast.error(errorMessage);
      console.error(error);
    } finally {
      setCreatingAccount(false);
    }
    */
  };

  const handleApproveRegistration = async (student: Student) => {
    if (!user || !profile) return;

    setApproving(student.id);
    try {
      // Get current session
      const { data: currentSession } = await supabase
        .from("academic_sessions")
        .select("id")
        .eq("is_current", true)
        .maybeSingle();
        
      if (!currentSession) throw new Error("No active session found");

      // Get supervisor ID
      const { data: supervisorRecord } = await supabase
        .from("supervisors")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!supervisorRecord) throw new Error("Supervisor profile not found");

      const { error } = await supabase
        .from("pre_registration")
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: supervisorRecord.id
        })
        .eq("student_id", student.id)
        .eq("session_id", currentSession.id);

      if (error) throw error;

      // Log audit for supervisor approval action
      try {
        const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
        await fetch(`${API_BASE_URL}/api/auth/log-activity`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            userType: "school_supervisor",
            userEmail: user.email,
            activityType: "pre_registration_approve",
            activityDetails: {
              studentId: student.id,
              studentMatric: student.matric_no,
              supervisorEmail: user.email,
            },
            success: true,
          }),
        }).catch(() => {}); // Don't block on logging failure
      } catch (logError) {
        console.error("Failed to log audit:", logError);
      }

      toast.success("Registration approved successfully!");
      fetchAllStudents();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to approve registration";
      toast.error(errorMessage);
      console.error(error);
    } finally {
      setApproving(null);
    }
  };

  const handleRejectRegistration = async (student: Student) => {
    if (!user || !profile) return;

    // Open dialog to get rejection reason
    setStudentToReject(student);
    setRejectionReason("");
    setRejectDialogOpen(true);
  };

  const confirmRejectRegistration = async () => {
    if (!user || !profile || !studentToReject) return;

    const student = studentToReject;
    const reason = rejectionReason.trim();
    
    setRejecting(student.id);
    setRejectDialogOpen(false);
    try {
      const supervisorEmail = user.email || "";
      // Get current session
      const { data: currentSession } = await supabase
        .from("academic_sessions")
        .select("id")
        .eq("is_current", true)
        .maybeSingle();
        
      if (!currentSession) throw new Error("No active session found");

      const { error } = await supabase
        .from("pre_registration")
        .update({
          status: 'rejected',
          remark: reason || "No reason provided"
        })
        .eq("student_id", student.id)
        .eq("session_id", currentSession.id);

      if (error) throw error;

      // Log audit for supervisor rejection action
      try {
        const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
        await fetch(`${API_BASE_URL}/api/auth/log-activity`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            userType: "school_supervisor",
            userEmail: user.email,
            activityType: "pre_registration_reject",
            activityDetails: {
              studentId: student.id,
              studentMatric: student.matric_no,
              supervisorEmail: supervisorEmail,
              rejectionReason: reason || "No reason provided",
            },
            success: true,
          }),
        }).catch(() => {}); // Don't block on logging failure
      } catch (logError) {
        console.error("Failed to log audit:", logError);
      }

      toast.success("Registration rejected. Student can resubmit.");
      setStudentToReject(null);
      setRejectionReason("");
      fetchAllStudents();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to reject registration";
      toast.error(errorMessage);
      console.error(error);
    } finally {
      setRejecting(null);
    }
  };

  const renderStudentCard = (student: Student, status: "pending" | "approved" | "rejected") => {
    const isRejected = student.other_info?.includes("Rejected:");
    const rejectionReason = isRejected 
      ? student.other_info?.replace("Rejected: ", "") || "No reason provided"
      : null;

    return (
      <Card key={student.id} className={`shadow-card ${status === "approved" ? "border-green-200 bg-green-50" : status === "rejected" ? "border-red-200 bg-red-50" : ""}`}>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="grid md:grid-cols-2 gap-4 flex-1">
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
              {status === "approved" && (
                <Badge className="bg-green-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Approved
                </Badge>
              )}
              {status === "rejected" && (
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" />
                  Rejected
                </Badge>
              )}
            </div>

            {status === "approved" && student.pre_registration_approved_at && (
              <div className="text-sm text-muted-foreground">
                Approved on: {new Date(student.pre_registration_approved_at).toLocaleDateString()}
              </div>
            )}

            {status === "rejected" && rejectionReason && (
              <div className="p-3 bg-red-100 border border-red-300 rounded-md">
                <p className="text-sm font-medium text-red-800">Rejection Reason:</p>
                <p className="text-sm text-red-700">{rejectionReason}</p>
              </div>
            )}

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
                      {status === "approved" && student.pre_registration_approved_at && (
                        <div>
                          <Label>Approved On</Label>
                          <p className="text-sm">{new Date(student.pre_registration_approved_at).toLocaleString()}</p>
                        </div>
                      )}
                      {status === "rejected" && rejectionReason && (
                        <div className="col-span-2">
                          <Label>Rejection Reason</Label>
                          <p className="text-sm text-red-600">{rejectionReason}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {status === "pending" && (
                <div className="flex gap-2 flex-wrap">
                  <Button
                    onClick={() => handleApproveRegistration(student)}
                    disabled={approving === student.id || rejecting === student.id}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    {approving === student.id ? "Approving..." : "Approve"}
                  </Button>
                  <Button
                    onClick={() => handleRejectRegistration(student)}
                    variant="destructive"
                    disabled={approving === student.id || rejecting === student.id}
                  >
                    <X className="h-4 w-4 mr-2" />
                    {rejecting === student.id ? "Rejecting..." : "Reject"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
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
              Review student registrations - pending, approved, and rejected
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="pending" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="pending">
                  <Clock className="h-4 w-4 mr-2" />
                  Pending ({pendingStudents.length})
                </TabsTrigger>
                <TabsTrigger value="approved">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approved ({approvedStudents.length})
                </TabsTrigger>
                <TabsTrigger value="rejected">
                  <XCircle className="h-4 w-4 mr-2" />
                  Rejected ({rejectedStudents.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pending" className="space-y-4 mt-4">
                {pendingStudents.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No pending registrations
                  </p>
                ) : (
                  pendingStudents.map((student) => renderStudentCard(student, "pending"))
                )}
              </TabsContent>

              <TabsContent value="approved" className="space-y-4 mt-4">
                {approvedStudents.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No approved registrations
                  </p>
                ) : (
                  approvedStudents.map((student) => renderStudentCard(student, "approved"))
                )}
              </TabsContent>

              <TabsContent value="rejected" className="space-y-4 mt-4">
                {rejectedStudents.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No rejected registrations
                  </p>
                ) : (
                  rejectedStudents.map((student) => renderStudentCard(student, "rejected"))
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>

      {/* Rejection Reason Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Registration</DialogTitle>
            <DialogDescription>
              {studentToReject && (
                <>Reject registration for student <strong>{studentToReject.matric_no}</strong>?</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Rejection Reason (optional)</Label>
              <Textarea
                id="rejection-reason"
                placeholder="Enter reason for rejection..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmRejectRegistration}
              disabled={rejecting === studentToReject?.id}
            >
              {rejecting === studentToReject?.id ? "Rejecting..." : "Reject Registration"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PendingRegistrations;
