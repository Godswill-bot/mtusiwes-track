import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Users, UserPlus, Loader2, Search } from "lucide-react";
import { FadeIn, SlideUp } from "@/components/animations/MotionWrappers";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Supervisor {
  id: string;
  name: string;
  email: string;
  supervisor_type: "industry_supervisor" | "school_supervisor";
}

interface Student {
  id: string;
  matric_no: string;
  full_name: string | null;
  department: string;
  faculty: string;
}

const fetchSessions = async () => {
  const { data, error } = await supabase
    .from("academic_sessions")
    .select("*")
    .order("session_name", { ascending: false });

  if (error) throw error;
  return data || [];
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

const fetchSupervisors = async (type?: "industry_supervisor" | "school_supervisor") => {
  let query = supabase.from("supervisors").select("*");

  if (type) {
    query = query.eq("supervisor_type", type);
  }

  const { data, error } = await query.order("name", { ascending: true });

  if (error) throw error;
  return (data || []) as Supervisor[];
};

const fetchStudents = async (sessionId: string) => {
  const { data, error } = await supabase
    .from("students")
    .select("id, matric_no, full_name, department, faculty")
    .eq("is_active", true)
    .order("matric_no", { ascending: true });

  if (error) throw error;
  return (data || []) as Student[];
};

const fetchCurrentAssignments = async (sessionId: string, supervisorId: string, assignmentType: string) => {
  const { data, error } = await supabase
    .from("supervisor_assignments")
    .select("student_id")
    .eq("session_id", sessionId)
    .eq("supervisor_id", supervisorId)
    .eq("assignment_type", assignmentType);

  if (error) throw error;
  return (data || []).map((a) => a.student_id);
};

const assignSupervisors = async ({
  supervisorId,
  studentIds,
  sessionId,
  assignmentType,
}: {
  supervisorId: string;
  studentIds: string[];
  sessionId: string;
  assignmentType: "industry_supervisor" | "school_supervisor";
}) => {
  // Get current admin user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Get admin ID
  const { data: admin } = await supabase
    .from("admins")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  // Get supervisor email for updating students table
  const { data: supervisor } = await supabase
    .from("supervisors")
    .select("email, name")
    .eq("id", supervisorId)
    .maybeSingle();

  if (!supervisor) throw new Error("Supervisor not found");

  // Delete existing assignments for this supervisor, session, and type
  await supabase
    .from("supervisor_assignments")
    .delete()
    .eq("supervisor_id", supervisorId)
    .eq("session_id", sessionId)
    .eq("assignment_type", assignmentType);

  // If school supervisor assignment, clear school_supervisor_email from students not in new assignment
  if (assignmentType === "school_supervisor") {
    // Get all students previously assigned to this supervisor
    const { data: previousAssignments } = await supabase
      .from("supervisor_assignments")
      .select("student_id")
      .eq("supervisor_id", supervisorId)
      .eq("session_id", sessionId)
      .eq("assignment_type", "school_supervisor");

    const previousStudentIds = previousAssignments?.map(a => a.student_id) || [];
    const studentsToUnassign = previousStudentIds.filter(id => !studentIds.includes(id));

    // Clear school_supervisor_email for unassigned students
    if (studentsToUnassign.length > 0) {
      await supabase
        .from("students")
        .update({ 
          school_supervisor_email: null,
          school_supervisor_name: null,
        })
        .in("id", studentsToUnassign);
    }
  }

  // Insert new assignments and update students table
  if (studentIds.length > 0) {
    const assignments = studentIds.map((studentId) => ({
      supervisor_id: supervisorId,
      student_id: studentId,
      session_id: sessionId,
      assignment_type: assignmentType,
      assigned_by: admin?.id || null,
    }));

    const { error } = await supabase
      .from("supervisor_assignments")
      .insert(assignments);

    if (error) throw error;

    // If school supervisor assignment, update school_supervisor_email in students table
    if (assignmentType === "school_supervisor") {
      const { error: updateError } = await supabase
        .from("students")
        .update({ 
          school_supervisor_email: supervisor.email,
          school_supervisor_name: supervisor.name,
        })
        .in("id", studentIds);

      if (updateError) throw updateError;
    }

    // Log audit for admin assignment action
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
      await fetch(`${API_BASE_URL}/api/auth/log-activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          userType: "admin",
          userEmail: user.email,
          activityType: "supervisor_assignment",
          activityDetails: {
            supervisorId,
            supervisorEmail: supervisor.email,
            studentIds,
            sessionId,
            assignmentType,
          },
          success: true,
        }),
      }).catch(() => {}); // Don't block on logging failure
    } catch (logError) {
      console.error("Failed to log audit:", logError);
    }
  }
};

export const SupervisorAssignment = () => {
  const queryClient = useQueryClient();
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [selectedSupervisor, setSelectedSupervisor] = useState<Supervisor | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [supervisorType, setSupervisorType] = useState<"industry_supervisor" | "school_supervisor">("school_supervisor");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["academic-sessions"],
    queryFn: fetchSessions,
  });

  const { data: currentSession } = useQuery({
    queryKey: ["current-session"],
    queryFn: fetchCurrentSession,
  });

  const { data: supervisors = [], isLoading: supervisorsLoading } = useQuery({
    queryKey: ["supervisors", supervisorType],
    queryFn: () => fetchSupervisors(supervisorType),
  });

  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["students", selectedSession],
    queryFn: () => fetchStudents(selectedSession),
    enabled: !!selectedSession,
  });

  const { data: currentAssignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ["supervisor-assignments", selectedSession, selectedSupervisor?.id, supervisorType],
    queryFn: () =>
      selectedSupervisor && selectedSession
        ? fetchCurrentAssignments(selectedSession, selectedSupervisor.id, supervisorType)
        : Promise.resolve([]),
    enabled: !!selectedSupervisor && !!selectedSession,
  });

  useEffect(() => {
    if (sessions.length > 0 && !selectedSession) {
      setSelectedSession(currentSession?.id || sessions[0].id);
    }
  }, [sessions, currentSession, selectedSession]);

  useEffect(() => {
    if (currentAssignments.length > 0) {
      setSelectedStudents(currentAssignments);
    } else {
      setSelectedStudents([]);
    }
  }, [currentAssignments]);

  const mutation = useMutation({
    mutationFn: assignSupervisors,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supervisor-assignments"] });
      toast.success("Supervisor assignments updated successfully");
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Failed to assign supervisors";
      toast.error(message);
    },
  });

  const handleToggleStudent = (studentId: string) => {
    setSelectedStudents((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleSelectAll = () => {
    if (selectedStudents.length === filteredStudents.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(filteredStudents.map((s) => s.id));
    }
  };

  const handleSave = () => {
    if (!selectedSupervisor || !selectedSession) {
      toast.error("Please select a supervisor and session");
      return;
    }

    mutation.mutate({
      supervisorId: selectedSupervisor.id,
      studentIds: selectedStudents,
      sessionId: selectedSession,
      assignmentType: supervisorType,
    });
  };

  const filteredStudents = students.filter(
    (student) =>
      !searchTerm ||
      student.matric_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <FadeIn>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">Supervisor Assignment</h2>
          <p className="text-muted-foreground">
            Assign supervisors to students for the selected academic session (One supervisor can be assigned to multiple students)
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Session & Supervisor Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Selection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Academic Session</Label>
                <Select value={selectedSession} onValueChange={setSelectedSession} disabled={sessionsLoading}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select session" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions.map((session) => (
                      <SelectItem key={session.id} value={session.id}>
                        {session.session_name}
                        {session.is_current && " (Current)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Supervisor Type</Label>
                <Select
                  value={supervisorType}
                  onValueChange={(value) => {
                    setSupervisorType(value as "industry_supervisor" | "school_supervisor");
                    setSelectedSupervisor(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="school_supervisor">School Supervisor</SelectItem>
                    <SelectItem value="industry_supervisor">Industry Supervisor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Select Supervisor</Label>
                <Select
                  value={selectedSupervisor?.id || ""}
                  onValueChange={(value) => {
                    const supervisor = supervisors.find((s) => s.id === value);
                    setSelectedSupervisor(supervisor || null);
                  }}
                  disabled={supervisorsLoading || !selectedSession}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select supervisor" />
                  </SelectTrigger>
                  <SelectContent>
                    {supervisors.map((supervisor) => (
                      <SelectItem key={supervisor.id} value={supervisor.id}>
                        {supervisor.name} ({supervisor.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedSupervisor && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="font-medium">{selectedSupervisor.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedSupervisor.email}</p>
                  <Badge variant="outline" className="mt-2">
                    {supervisorType.replace("_", " ")}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Student Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Assign Students
              </CardTitle>
              <CardDescription>
                {selectedStudents.length} of {filteredStudents.length} students selected
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedSession && selectedSupervisor ? (
                <>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Search students..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                      <Button variant="outline" onClick={handleSelectAll} size="icon">
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="max-h-[400px] overflow-y-auto border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={selectedStudents.length === filteredStudents.length && filteredStudents.length > 0}
                              onCheckedChange={handleSelectAll}
                            />
                          </TableHead>
                          <TableHead>Matric No</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Department</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredStudents.map((student) => (
                          <TableRow key={student.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedStudents.includes(student.id)}
                                onCheckedChange={() => handleToggleStudent(student.id)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{student.matric_no}</TableCell>
                            <TableCell>{student.full_name || "N/A"}</TableCell>
                            <TableCell>{student.department}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <Button
                    onClick={handleSave}
                    className="w-full"
                    disabled={mutation.isPending || assignmentsLoading || !selectedSupervisor}
                  >
                    {mutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Save Assignments
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Please select a session and supervisor to assign students
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </FadeIn>
  );
};














