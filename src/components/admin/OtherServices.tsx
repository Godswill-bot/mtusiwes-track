import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Download, FileText, Calendar, CheckSquare, Loader2 } from "lucide-react";
import { AnimatedCard } from "@/components/animations/MotionWrappers";
import { format } from "date-fns";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

// Fetch academic sessions
const fetchSessions = async () => {
  const { data, error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("academic_sessions" as any)
    .select("*")
    .order("session_name", { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as Array<{ id: string; session_name: string; is_current: boolean; created_at: string; updated_at: string }>;
};

// Fetch current session
const fetchCurrentSession = async () => {
  const { data, error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("academic_sessions" as any)
    .update({ is_current: false })
    .neq("id", sessionId);

  if (unsetError) throw unsetError;

  const { error: setError } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("academic_sessions" as any)
    .update({ is_current: true })
    .eq("id", sessionId);

  if (setError) throw setError;
  return sessionId;
};
// Get system setting
const getSystemSetting = async (sessionId: string, key: string) => {
  const { data, error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("system_settings" as any)
    .select("setting_value")
    .eq("session_id", sessionId)
    .eq("setting_key", key)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw error;
  return ((data as unknown as { setting_value: unknown } | null)?.setting_value) || null;
};

// Set system setting
const updateSystemSetting = async (sessionId: string, key: string, value: unknown) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("system_settings")
    .upsert(
      {
        session_id: sessionId,
        setting_key: key,
        setting_value: value,
      },
      {
        onConflict: "session_id,setting_key",
      }
    );

  if (error) throw error;
  return value;
};

interface OtherServicesProps {
  compact?: boolean;
}

export const OtherServices = ({ compact = false }: OtherServicesProps) => {
  const queryClient = useQueryClient();
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [acceptanceDate, setAcceptanceDate] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const { data: sessions = [], isPending: sessionsPending } = useQuery({
    queryKey: ["academic-sessions"],
    queryFn: fetchSessions,
  });

  const { data: currentSession, isPending: currentPending } = useQuery({
    queryKey: ["current-session"],
    queryFn: fetchCurrentSession,
  });

  const { data: currentAcceptanceDate } = useQuery({
    queryKey: ["system-settings", currentSession?.id, "acceptance_letter_date"],
    queryFn: () => getSystemSetting(currentSession?.id || "", "acceptance_letter_date"),
    enabled: !!currentSession?.id,
  });

  const { data: attachmentPeriod } = useQuery({
    queryKey: ["system-settings", currentSession?.id, "attachment_period"],
    queryFn: () => getSystemSetting(currentSession?.id || "", "attachment_period"),
    enabled: !!currentSession?.id,
  });

  useEffect(() => {
    if (sessions.length > 0 && !selectedSession) {
      setSelectedSession(currentSession?.id || sessions[0].id);
    }
  }, [sessions, currentSession, selectedSession]);

  useEffect(() => {
    if (currentAcceptanceDate && typeof currentAcceptanceDate === 'string') {
      try {
        const date = new Date(currentAcceptanceDate);
        setAcceptanceDate(format(date, "yyyy-MM-dd"));
      } catch (e) {
        // Invalid date
      }
    }
  }, [currentAcceptanceDate]);

  useEffect(() => {
    if (attachmentPeriod && typeof attachmentPeriod === 'object') {
      const period = attachmentPeriod as { from_date?: string; to_date?: string };
      setFromDate(period.from_date || "");
      setToDate(period.to_date || "");
    }
  }, [attachmentPeriod]);

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

  const setAcceptanceDateMutation = useMutation({
    mutationFn: async (date: string) => {
      if (!currentSession?.id) throw new Error("No current session selected");
      return updateSystemSetting(currentSession.id, "acceptance_letter_date", date);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
      toast.success("Acceptance letter submission date set successfully");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Failed to set acceptance letter date");
    },
  });

  const setAttachmentPeriodMutation = useMutation({
    mutationFn: async ({ from, to }: { from: string; to: string }) => {
      if (!currentSession?.id) throw new Error("No current session selected");
      return updateSystemSetting(currentSession.id, "attachment_period", {
        from_date: from,
        to_date: to,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
      toast.success("Period of attachment set successfully");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Failed to set attachment period");
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

  const handleDownloadWeeklyReports = async (format: "pdf" | "csv") => {
    if (!selectedSession) {
      toast.error("Please select an academic session");
      return;
    }

    try {
      const sessionName = sessions.find((s) => s.id === selectedSession)?.session_name || "unknown";
      const endpoint = format === "pdf"
        ? "/api/admin/download-weekly-reports-pdf"
        : "/api/admin/download-weekly-reports-csv";

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
      a.download = `weekly_reports_${sessionName}_${Date.now()}.${format === "pdf" ? "pdf" : "csv"}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`Weekly reports downloaded successfully`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to download weekly reports");
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

        {/* Set Date for Acceptance Letter Submission */}
        <AnimatedCard delay={0.4}>
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-2 flex-shrink-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4" />
                Acceptance Letter Date
              </CardTitle>
              <CardDescription className="text-xs">Set submission deadline</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 flex-1 flex flex-col justify-between pt-2">
              <div className="space-y-2">
                <Label className="text-sm">Submission Date</Label>
                <Input
                  type="date"
                  className="h-9"
                  value={acceptanceDate}
                  onChange={(e) => setAcceptanceDate(e.target.value)}
                />
              </div>
              <Button
                size="sm"
                onClick={() => {
                  if (!acceptanceDate) {
                    toast.error("Please select a date");
                    return;
                  }
                  setAcceptanceDateMutation.mutate(acceptanceDate);
                }}
                className="w-full"
                disabled={setAcceptanceDateMutation.isPending || !acceptanceDate}
              >
                {setAcceptanceDateMutation.isPending ? (
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

        {/* Set Period of Attachment */}
        <AnimatedCard delay={0.5}>
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-2 flex-shrink-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4" />
                Attachment Period
              </CardTitle>
              <CardDescription className="text-xs">Set the training period</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 flex-1 flex flex-col justify-between pt-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">From</Label>
                  <Input
                    type="date"
                    className="h-9 text-xs"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">To</Label>
                  <Input
                    type="date"
                    className="h-9 text-xs"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                  />
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  if (!fromDate || !toDate) {
                    toast.error("Please select both dates");
                    return;
                  }
                  if (new Date(fromDate) > new Date(toDate)) {
                    toast.error("From date must be before to date");
                    return;
                  }
                  setAttachmentPeriodMutation.mutate({ from: fromDate, to: toDate });
                }}
                className="w-full"
                disabled={setAttachmentPeriodMutation.isPending || !fromDate || !toDate}
              >
                {setAttachmentPeriodMutation.isPending ? (
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

        {/* Download Weekly Reports */}
        <AnimatedCard delay={0.7}>
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-2 flex-shrink-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                Weekly Reports
              </CardTitle>
              <CardDescription className="text-xs">Download all weekly reports</CardDescription>
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
                  onClick={() => handleDownloadWeeklyReports("pdf")}
                  className="flex-1 text-xs"
                  disabled={!selectedSession}
                >
                  <FileText className="h-3 w-3 mr-1" />
                  PDF
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleDownloadWeeklyReports("csv")}
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
      </div>
    </div>
  );
};

