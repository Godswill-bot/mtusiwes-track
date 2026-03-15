import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Download, FileText, Calendar, CheckSquare, Loader2, ShieldAlert } from "lucide-react";
import { AnimatedCard } from "@/components/animations/MotionWrappers";

const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "" : "http://localhost:3001");

// Fetch academic sessions
const fetchSessions = async () => {
  const { data, error } = await supabase
     
    .from("academic_sessions" as any)
    .select("*")
    .order("session_name", { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as Array<{ id: string; session_name: string; is_current: boolean; created_at: string; updated_at: string }>;
};

// Fetch current session
const fetchCurrentSession = async () => {
  const { data, error } = await supabase
     
    .from("academic_sessions" as any)
    .select("*")
    .eq("is_current", true)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data as unknown as { id: string; session_name: string; is_current: boolean; created_at: string; updated_at: string } | null;
};
// Set current session
const setCurrentSession = async (sessionId: string) => {
  // First unset all sessions, then set the selected one
  const { error: unsetError } = await supabase
     
    .from("academic_sessions" as any)
    .update({ is_current: false })
    .neq("id", sessionId);

  if (unsetError) throw unsetError;

  const { error: setError } = await supabase
     
    .from("academic_sessions" as any)
    .update({ is_current: true })
    .eq("id", sessionId);

  if (setError) throw setError;
  return sessionId;
};

interface OtherServicesProps {
  compact?: boolean;
}

export const OtherServices = ({ compact = false }: OtherServicesProps) => {
  const queryClient = useQueryClient();
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [resetConfirmationText, setResetConfirmationText] = useState("");
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const { data: sessions = [], isPending: sessionsPending } = useQuery({
    queryKey: ["academic-sessions"],
    queryFn: fetchSessions,
  });

  const { data: currentSession, isPending: currentPending } = useQuery({
    queryKey: ["current-session"],
    queryFn: fetchCurrentSession,
  });

  useEffect(() => {
    if (sessions.length > 0 && !selectedSession) {
      setSelectedSession(currentSession?.id || sessions[0].id);
    }
  }, [sessions, currentSession, selectedSession]);

  const setCurrentSessionMutation = useMutation({
    mutationFn: setCurrentSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["current-session"] });
      toast.success("Current academic session updated successfully");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Failed to set current session");
    },
  });


  const resetStudentsMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-students", {
        body: {
          action: "reset_students_for_new_cycle",
          confirmation_text: resetConfirmationText,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data: {
      totalStudents: number;
      blockedCount: number;
      deletedAuthCount: number;
      failedAuthDeletes?: string[];
    }) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "students"] });

      const failedCount = data.failedAuthDeletes?.length || 0;
      if (failedCount > 0) {
        toast.warning(
          `Reset finished with warnings. ${data.deletedAuthCount}/${data.totalStudents} auth accounts deleted, ${data.blockedCount} emails blocked, ${failedCount} auth deletions failed.`
        );
      } else {
        toast.success(
          `Student reset complete. ${data.deletedAuthCount} auth accounts removed and ${data.blockedCount} emails blocked.`
        );
      }

      setResetDialogOpen(false);
      setResetConfirmationText("");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Failed to reset students");
    },
  });

  const backfillAssignmentsMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-students", {
        body: {
          action: "backfill_school_supervisor_assignments",
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data: {
      preRegistrationCount: number;
      attemptedAssignments: number;
      createdAssignments: number;
      failedAssignments?: Array<{ student_id: string; reason: string }>;
      syncedPreRegistrationRows: number;
      syncedStudents: number;
      activeSchoolSupervisors?: number;
      message?: string;
    }) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "students"] });
      queryClient.invalidateQueries({ queryKey: ["pending-registrations"] });

      if (data.message) {
        toast.info(data.message);
        return;
      }

      const failedCount = data.failedAssignments?.length || 0;
      if (failedCount > 0) {
        const sampleReason = data.failedAssignments?.[0]?.reason;
        toast.warning(
          `Backfill complete with warnings. Created ${data.createdAssignments}/${data.attemptedAssignments} missing assignments, synced ${data.syncedStudents} students, ${failedCount} failed.${sampleReason ? ` First issue: ${sampleReason}.` : ""}`
        );
      } else {
        toast.success(
          `Backfill complete. Created ${data.createdAssignments} assignments and synced ${data.syncedStudents} students.`
        );
      }
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Failed to backfill assignments");
    },
  });

  const handleDownloadMasterList = async (format: "pdf" | "csv") => {
    if (!selectedSession) {
      toast.error("Please select an academic session");
      return;
    }

    try {
      const sessionName = sessions.find((s) => s.id === selectedSession)?.session_name || "unknown";
      const endpoint = format === "pdf" 
        ? "/api/admin/download-master-list-pdf"
        : "/api/admin/download-master-list-csv";

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: selectedSession }),
      });

      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `master_list_${sessionName}_${Date.now()}.${format === "pdf" ? "pdf" : "csv"}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`Master list downloaded successfully`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to download master list");
    }
  };

  const handleDownloadPlacementList = async (format: "pdf" | "csv") => {
    if (!selectedSession) {
      toast.error("Please select an academic session");
      return;
    }

    try {
      const sessionName = sessions.find((s) => s.id === selectedSession)?.session_name || "unknown";
      const endpoint = format === "pdf"
        ? "/api/admin/download-placement-list-pdf"
        : "/api/admin/download-placement-list-csv";

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: selectedSession }),
      });

      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `placement_list_${sessionName}_${Date.now()}.${format === "pdf" ? "pdf" : "csv"}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`Placement list downloaded successfully`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to download placement list");
    }
  };

  const handleDownloadSupervisorAssignments = async (format: "pdf" | "csv") => {
    if (!selectedSession) {
      toast.error("Please select an academic session");
      return;
    }

    try {
      const sessionName = sessions.find((s) => s.id === selectedSession)?.session_name || "unknown";
      const endpoint = format === "pdf"
        ? "/api/admin/download-supervisor-assignments-pdf"
        : "/api/admin/download-supervisor-assignments-csv";

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: selectedSession }),
      });

      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `supervisor_assignments_${sessionName}_${Date.now()}.${format === "pdf" ? "pdf" : "csv"}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`Supervisor assignments downloaded successfully`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to download supervisor assignments");
    }
  };

  if (sessionsPending || currentPending) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Manage academic sessions, downloads, system settings, and more. Click to view full screen.
        </p>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span>Master List</span>
          </div>
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-muted-foreground" />
            <span>Placement List</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>Session Settings</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
            <span>Supervisor Reports</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-full overflow-hidden">
      <div className="flex-shrink-0">
        <h2 className="text-2xl font-bold mb-2">Other Services</h2>
        <p className="text-muted-foreground">
          Manage academic sessions, downloads, and system settings
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-fr">
        {/* Download Master List */}
        <AnimatedCard delay={0.1}>
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-2 flex-shrink-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                Download Master List
              </CardTitle>
              <CardDescription className="text-xs">Download complete student master list</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 flex-1 flex flex-col justify-between pt-2">
              <div className="space-y-2">
                <Label className="text-sm">Academic Session</Label>
                <Select value={selectedSession} onValueChange={setSelectedSession}>
                  <SelectTrigger className="h-9">
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
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDownloadMasterList("pdf")}
                  className="flex-1 text-xs"
                  disabled={!selectedSession}
                >
                  <FileText className="h-3 w-3 mr-1" />
                  PDF
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleDownloadMasterList("csv")}
                  className="flex-1 text-xs"
                  disabled={!selectedSession}
                >
                  <Download className="h-3 w-3 mr-1" />
                  CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        </AnimatedCard>

        {/* Download Placement List */}
        <AnimatedCard delay={0.2}>
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-2 flex-shrink-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                Download Placement List
              </CardTitle>
              <CardDescription className="text-xs">Download student placement list</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 flex-1 flex flex-col justify-between pt-2">
              <div className="space-y-2">
                <Label className="text-sm">Academic Session</Label>
                <Select value={selectedSession} onValueChange={setSelectedSession}>
                  <SelectTrigger className="h-9">
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
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDownloadPlacementList("pdf")}
                  className="flex-1 text-xs"
                  disabled={!selectedSession}
                >
                  <FileText className="h-3 w-3 mr-1" />
                  PDF
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleDownloadPlacementList("csv")}
                  className="flex-1 text-xs"
                  disabled={!selectedSession}
                >
                  <Download className="h-3 w-3 mr-1" />
                  CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        </AnimatedCard>

        {/* Set Current Academic Session */}
        <AnimatedCard delay={0.3}>
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-2 flex-shrink-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckSquare className="h-4 w-4" />
                Set Current Session
              </CardTitle>
              <CardDescription className="text-xs">Set the active academic session</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 flex-1 flex flex-col justify-between pt-2">
              <div className="space-y-2">
                <Label className="text-sm">Academic Session</Label>
                <Select
                  value={currentSession?.id || ""}
                  onValueChange={(value) => setCurrentSessionMutation.mutate(value)}
                >
                  <SelectTrigger className="h-9">
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
              <Button
                size="sm"
                onClick={() => currentSession && setCurrentSessionMutation.mutate(currentSession.id)}
                className="w-full"
                disabled={setCurrentSessionMutation.isPending || !currentSession}
              >
                {setCurrentSessionMutation.isPending ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Setting...
                  </>
                ) : (
                  "Set Now"
                )}
              </Button>
            </CardContent>
          </Card>
        </AnimatedCard>


        {/* Download Supervisor Assigned */}
        <AnimatedCard delay={0.6}>
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-2 flex-shrink-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                Supervisor Assignments
              </CardTitle>
              <CardDescription className="text-xs">Download assignment list</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 flex-1 flex flex-col justify-between pt-2">
              <div className="space-y-2">
                <Label className="text-sm">Academic Session</Label>
                <Select value={selectedSession} onValueChange={setSelectedSession}>
                  <SelectTrigger className="h-9">
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
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDownloadSupervisorAssignments("pdf")}
                  className="flex-1 text-xs"
                  disabled={!selectedSession}
                >
                  <FileText className="h-3 w-3 mr-1" />
                  PDF
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleDownloadSupervisorAssignments("csv")}
                  className="flex-1 text-xs"
                  disabled={!selectedSession}
                >
                  <Download className="h-3 w-3 mr-1" />
                  CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        </AnimatedCard>

        <AnimatedCard delay={0.7}>
          <Card className="h-full flex flex-col border-primary/20">
            <CardHeader className="pb-2 flex-shrink-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckSquare className="h-4 w-4" />
                Backfill Pending Assignments
              </CardTitle>
              <CardDescription className="text-xs">
                One-click fix for already-submitted pre-SIWES records that have no assigned school supervisor.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 flex-1 flex flex-col justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                Uses current session only and updates `pre_registration` plus student supervisor fields used by the admin table.
              </p>
              <Button
                size="sm"
                className="w-full"
                onClick={() => backfillAssignmentsMutation.mutate()}
                disabled={backfillAssignmentsMutation.isPending}
              >
                {backfillAssignmentsMutation.isPending ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Running Backfill...
                  </>
                ) : (
                  "Run Backfill Now"
                )}
              </Button>
            </CardContent>
          </Card>
        </AnimatedCard>

        <AnimatedCard delay={0.8}>
          <Card className="h-full flex flex-col border-destructive/30">
            <CardHeader className="pb-2 flex-shrink-0">
              <CardTitle className="flex items-center gap-2 text-base text-destructive">
                <ShieldAlert className="h-4 w-4" />
                Student Reset (End of SIWES)
              </CardTitle>
              <CardDescription className="text-xs">
                Removes student login accounts, preserves historical student records, and permanently blocks those emails from self-service signup.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 flex-1 flex flex-col justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                Requirement: student portal must be closed before this action can run.
              </p>

              <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="w-full">
                    Run Student Reset
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirm Student Reset</DialogTitle>
                    <DialogDescription>
                      This will delete all current student auth accounts, keep historical student records in the database, and block those emails from future self-service student signup.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-2">
                    <Label htmlFor="reset-confirmation">
                      Type <span className="font-semibold">RESET STUDENTS</span> to continue
                    </Label>
                    <Input
                      id="reset-confirmation"
                      value={resetConfirmationText}
                      onChange={(e) => setResetConfirmationText(e.target.value)}
                      placeholder="RESET STUDENTS"
                    />
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setResetDialogOpen(false);
                        setResetConfirmationText("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={
                        resetConfirmationText !== "RESET STUDENTS" ||
                        resetStudentsMutation.isPending
                      }
                      onClick={() => resetStudentsMutation.mutate()}
                    >
                      {resetStudentsMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Resetting...
                        </>
                      ) : (
                        "Confirm Reset"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </AnimatedCard>
      </div>
    </div>
  );
};

