import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { FileText, BookOpen, Calendar, CheckCircle, XCircle, Clock, Building, ArrowLeft, Lock, Award, Bell, Briefcase, GraduationCap, Laptop, Route, Map, FileSignature, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { PDFDownloadButton } from "@/components/PDFDownloadButton";
import SupervisorStudentChatDrawer from "@/components/SupervisorStudentChatDrawer";
import { usePortalStatus } from "@/hooks/usePortalStatus";
import PortalClosed from "./PortalClosed";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StudentNotifications } from "@/components/student/StudentNotifications";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SignaturePad } from "@/components/SignaturePad";

type StudentInfo = {
  id?: string;
  pre_registration?: Array<{ status?: string; remark?: string }> | { status?: string; remark?: string };
  siwes_locked?: boolean;
  school_supervisor_id?: string;
  school_supervisor_name?: string;
  school_supervisor_email?: string;
  school_supervisor_photo_url?: string;
  supervisor_id?: string;
  supervisor_assignments?: Array<{ supervisor_id?: string }>;
  industry_supervisor_signature_url?: string;
  [key: string]: any;
};

const StudentBackgroundIcons = () => (
  <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-[0.04] text-primary">
    <Briefcase className="absolute top-[15%] left-[8%] w-32 h-32 -rotate-12" />
    <GraduationCap className="absolute top-[25%] right-[12%] w-40 h-40 rotate-[15deg]" />
    <Laptop className="absolute top-[45%] left-[15%] w-28 h-28 -rotate-6" />
    <FileSignature className="absolute top-[65%] right-[8%] w-36 h-36 rotate-12" />
    <Route className="absolute top-[80%] left-[15%] w-32 h-32 -rotate-12" />
    <Map className="absolute top-[35%] right-[30%] w-24 h-24 rotate-45" />
    <Building className="absolute top-[75%] right-[25%] w-28 h-28 -rotate-12" />
    <Award className="absolute top-[55%] left-[30%] w-20 h-20 rotate-12" />
  </div>
);

const StudentDashboard = () => {
  const { user, userRole, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { portalOpen, loading: portalLoading } = usePortalStatus();
  const [hasRegistration, setHasRegistration] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [isRejected, setIsRejected] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
  const [siwesLocked, setSiwesLocked] = useState(false);
  const [gradeInfo, setGradeInfo] = useState<{
    grade: string;
    totalScore: number;
    attendanceScore: number;
    weeklyReportsScore: number;
    supervisorApprovalScore: number;
    remarks?: string;
  } | null>(null);
  const [stats, setStats] = useState({
    totalWeeks: 0,
    submitted: 0,
    approved: 0,
    rejected: 0,
    pending: 0,
  });
  const [allWeeksCompleted, setAllWeeksCompleted] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [showIndustrySignaturePad, setShowIndustrySignaturePad] = useState(false);
  // Fetch unread notifications count (personal unread + new announcements)
  const { data: unreadNotificationsCount = 0 } = useQuery({
    queryKey: ["student", "unread-notifications", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;

      const lastReadISO =
        localStorage.getItem(`lastReadNotificationTime_${user.id}`)
        || localStorage.getItem(`lastReadAnnouncementTime_${user.id}`);

      const personalUnreadQuery = (supabase as any)
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      let announcementsQuery = (supabase as any)
        .from("announcements")
        .select("id", { count: "exact", head: true });

      if (lastReadISO) {
        announcementsQuery = announcementsQuery.gt("created_at", lastReadISO);
      }

      const [{ count: personalCount, error: personalError }, { count: annCount, error: annError }] = await Promise.all([
        personalUnreadQuery,
        announcementsQuery,
      ]);

      if (personalError || annError) {
        console.error("Error fetching unread notifications count:", personalError || annError);
        return 0;
      }

      return (personalCount || 0) + (annCount || 0);
    },
    enabled: !!user?.id,
  });

  // Fetch current session
  const { data: currentSession } = useQuery({
    queryKey: ["current-session"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academic_sessions")
        .select("*")
        .eq("is_current", true)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });


  useEffect(() => {
    if (userRole && userRole !== "student") {
      navigate("/");
    }
  }, [userRole, navigate]);




  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      if (!user?.id) {
        setLoading(false);
        return;
      }
      
      // 1. Fetch Student Data & Pre-Registration in ONE query
      const { data: studentData, error: studentError } = await (supabase as any)
        .from("students")
        .select(`
          *,
          pre_registration (
            status,
            remark
          )
        `)
        .eq("user_id", user.id)
        .maybeSingle();

      if (studentError && studentError.code !== 'PGRST116') throw studentError;

      setHasRegistration(!!studentData);
      
      let enrichedStudentData: StudentInfo | null = studentData as StudentInfo | null;
      if (studentData) {
        // ALWAYS try to get the supervisor assignment to ensure we have the ID for chat
        const { data: assignment } = await supabase
          .from("supervisor_assignments")
          .select("supervisor_id, supervisors(name, email)")
          .eq("student_id", studentData.id)
          .eq("assignment_type", "school_supervisor")
          .maybeSingle();

        const typedAssignment = assignment as any;
        if (typedAssignment && typedAssignment.supervisor_id) {
          enrichedStudentData = {
            ...(studentData as StudentInfo),
            school_supervisor_id: typedAssignment.supervisor_id,
            school_supervisor_name: typedAssignment.supervisors?.name || (studentData as StudentInfo).school_supervisor_name,
            school_supervisor_email: typedAssignment.supervisors?.email || (studentData as StudentInfo).school_supervisor_email,
          };
        }
      }
      
      setStudentInfo(enrichedStudentData);

      if (studentData) {
        // Handle Pre-Registration Status
        // pre_registration is an array because of one-to-many relationship in Supabase types
        // but we know it's unique per session. We should take the latest or filter by session if needed.
        // For now, assuming the latest or single active one is what we get or we can sort.
        // Actually, let's just take the first one if it exists.
        const preReg = Array.isArray((studentData as any).pre_registration) 
          ? (studentData as any).pre_registration[0] 
          : (studentData as any).pre_registration;

        const status = (preReg as any)?.status || 'pending';
        setIsApproved(status === 'approved');
        setIsRejected(status === 'rejected');
        setRejectionReason(preReg?.remark || null);

        // Check if SIWES is locked (after grading)
        setSiwesLocked(studentData.siwes_locked === true);

        // If locked, fetch grade information
        if (studentData.siwes_locked === true) {
          const { data: gradeData } = await (supabase as any)
            .from("supervisor_grades")
            .select("*")
            .eq("student_id", studentData.id)
            .maybeSingle();

          if (gradeData) {
            setGradeInfo({
              grade: gradeData.grade,
              totalScore: gradeData.total_score || gradeData.score,
              attendanceScore: gradeData.attendance_score || 0,
              weeklyReportsScore: gradeData.weekly_reports_score || 0,
              supervisorApprovalScore: gradeData.supervisor_approval_score || 0,
              remarks: gradeData.remarks,
            });
          }
        }

        // 2. Fetch Weeks Stats
        const { data: weeksData } = await supabase
          .from("weeks")
          .select("status, week_number")
          .eq("student_id", studentData.id)
          .lte("week_number", 24);

        const totalWeeks = 24; // SIWES is typically 24 weeks
        const approved = weeksData?.filter(w => w.status === "approved").length || 0;
        const rejected = weeksData?.filter(w => w.status === "rejected").length || 0;
        const strictlySubmitted = weeksData?.filter(w => w.status === "submitted").length || 0;
        
        // Total submitted includes currently submitted, approved, and rejected weeks
        const totalSubmitted = strictlySubmitted + approved + rejected;
        
        // Pending is all remaining weeks up to 24 that haven't been submitted
        const pending = Math.max(0, 24 - totalSubmitted);

        setStats({
          totalWeeks,
          submitted: totalSubmitted,
          approved,
          rejected,
          pending,
        });

        setAllWeeksCompleted(totalSubmitted >= 24 || studentData.siwes_locked === true);
      } else {
        setIsApproved(false);
        setIsRejected(false);
      }
    } catch (error: unknown) {
      toast.error("Error loading dashboard");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user, loadDashboardData]);

  const handleUploadIndustrySignature = async (file: File) => {
    if (!user?.id || !studentInfo?.id) return;
    try {
      const fileName = `industry_supervisor_${user.id}_${Date.now()}.png`;

      // Upload file to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('student-photos')
        .upload(`signatures/${fileName}`, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('student-photos')
        .getPublicUrl(`signatures/${fileName}`);

      // Update student table with URL
      const { error: updateError } = await (supabase as any)
        .from('students')
        .update({ industry_supervisor_signature_url: publicUrl })
        .eq('id', studentInfo.id);

      if (updateError) throw updateError;

      // Update local state
      setStudentInfo(prev => prev ? { ...prev, industry_supervisor_signature_url: publicUrl } : prev);
      
      toast.success("Industry supervisor signature saved successfully");
      setShowIndustrySignaturePad(false);
    } catch (error) {
      console.error("Error uploading signature:", error);
      toast.error("Failed to upload signature. Please try again.");
    }
  };

  if (portalLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  // Check portal status - redirect if closed
  if (portalOpen === false) {
    return <PortalClosed />;
  }

  // Calculate completion percentage based on total submitted vs total expected weeks (24)
  const completionPercentage = stats.totalWeeks > 0
    ? Math.min(100, Math.round((stats.submitted / stats.totalWeeks) * 100))
    : 0;
  const registrationStatusLabel = !hasRegistration
    ? "Not Submitted"
    : isApproved
      ? "Submitted & Approved"
      : isRejected
        ? "Submitted & Rejected"
        : "Submitted";
  const registrationStatusTone = !hasRegistration
    ? "secondary"
    : isApproved
      ? "default"
      : isRejected
        ? "destructive"
        : "outline";
  const phaseLabel = !hasRegistration
    ? "Registration Not Started"
    : siwesLocked
      ? "SIWES Completed"
      : isApproved
        ? "Active SIWES"
        : isRejected
          ? "Needs Correction"
          : "Awaiting Approval";
  const reviewedItems = stats.approved + stats.rejected;
  const approvalRate = reviewedItems > 0 ? Math.round((stats.approved / reviewedItems) * 100) : 0;

  const reminders: Array<{ title: string; action: string; path?: string; onClick?: () => void }> = [];
  if (!hasRegistration) {
    reminders.push({ title: "Complete your Pre-SIWES registration", action: "Open form", path: "/student/pre-siwes" });
  }
  if (hasRegistration && isRejected) {
    reminders.push({ title: "Registration was rejected. Correct and resubmit", action: "Edit registration", path: "/student/pre-siwes/edit" });
  }
  if (hasRegistration && !isApproved && !isRejected) {
    reminders.push({ title: "Registration submitted and waiting for supervisor approval", action: "View registration", path: "/student/pre-siwes" });
  }
  if (isApproved && !siwesLocked && stats.pending > 0) {
    reminders.push({ title: `You still have ${stats.pending} pending week(s) to submit`, action: "Go to logbook", path: "/student/logbook" });
  }
  if (studentInfo && !studentInfo.industry_supervisor_signature_url) {
    reminders.push({ title: "Industry supervisor signature is missing", action: "Add signature", onClick: () => setShowIndustrySignaturePad(true) });
  }
  if (unreadNotificationsCount > 0) {
    reminders.push({ title: `You have ${unreadNotificationsCount} unread notification(s)`, action: "View notifications", path: "/student/notifications" });
  }

  const timeline = [
    { label: "Pre-SIWES registration", done: hasRegistration, note: hasRegistration ? "Submitted" : "Not submitted" },
    { label: "Supervisor approval", done: isApproved, note: isApproved ? "Approved" : isRejected ? "Rejected" : "Pending" },
    { label: "Logbook started", done: stats.submitted > 0, note: `${stats.submitted} week(s) submitted` },
    { label: "All weeks completed", done: allWeeksCompleted, note: allWeeksCompleted ? "Completed" : "In progress" },
    { label: "Final lock & grading", done: siwesLocked, note: siwesLocked ? "Locked" : "Not yet" },
  ];

  return (
    <div className="min-h-screen bg-background relative z-0">
      <StudentBackgroundIcons />
      <Navbar />

      <main className="w-full px-4 sm:px-7 lg:px-12 py-8 relative z-10">
        <div className="max-w-[1760px] mx-auto space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-primary">
                Welcome back, {profile?.full_name || "Student"}!
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-1">
                {siwesLocked
                  ? "Your SIWES has been completed and graded. View your final results below."
                  : "Track your SIWES progress and manage your weekly logbook"}
              </p>
            </div>
            {!siwesLocked && (
              <div className="flex gap-2 self-start sm:self-auto">
                <Button variant="outline" size="sm" className="sm:size-default" onClick={() => navigate("/student/profile/edit")}>
                  Edit Profile
                </Button>
              </div>
            )}
          </div>

          {/* Student Notifications */}
          <StudentNotifications />

          <Card className="border-primary/20 shadow-card bg-gradient-to-r from-primary/10 via-card to-accent/10">
            <CardContent className="py-5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Today</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{new Date().toLocaleDateString()}</Badge>
                  <Badge variant={siwesLocked ? "secondary" : "default"}>{phaseLabel}</Badge>
                  <Badge variant={registrationStatusTone as any}>{registrationStatusLabel}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {currentSession?.name ? `Session: ${currentSession.name}` : "Current session active"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => navigate("/student/pre-siwes")}>Registration</Button>
                <Button variant="outline" onClick={() => navigate("/student/logbook")} disabled={!isApproved || siwesLocked}>Logbook</Button>
                <Button variant="outline" onClick={() => navigate("/student/notifications")}>Notifications</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card border-border/60">
            <CardHeader>
              <CardTitle>Student Workspace</CardTitle>
              <CardDescription>Everything important in one place</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-auto gap-1">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="documents">Documents</TabsTrigger>
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                  <TabsTrigger value="support">Support</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card className="border-border/60">
                    <CardHeader>
                      <CardTitle className="text-base">What To Do Next</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {reminders.length > 0 ? reminders.slice(0, 4).map((item, idx) => (
                        <div key={`${item.title}-${idx}`} className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-muted/30">
                          <p className="text-sm">{item.title}</p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (item.onClick) {
                                item.onClick();
                                return;
                              }
                              if (item.path) {
                                navigate(item.path);
                              }
                            }}
                          >
                            {item.action}
                          </Button>
                        </div>
                      )) : (
                        <p className="text-sm text-muted-foreground">No pending actions right now. Great job.</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-border/60">
                    <CardHeader>
                      <CardTitle className="text-base">Quick Insights</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg border bg-muted/20">
                        <p className="text-xs text-muted-foreground">Completion Pace</p>
                        <p className="text-xl font-semibold">{stats.submitted}/24</p>
                      </div>
                      <div className="p-3 rounded-lg border bg-muted/20">
                        <p className="text-xs text-muted-foreground">Approval Rate</p>
                        <p className="text-xl font-semibold">{approvalRate}%</p>
                      </div>
                      <div className="p-3 rounded-lg border bg-muted/20">
                        <p className="text-xs text-muted-foreground">Pending Weeks</p>
                        <p className="text-xl font-semibold">{stats.pending}</p>
                      </div>
                      <div className="p-3 rounded-lg border bg-muted/20">
                        <p className="text-xs text-muted-foreground">Unread Alerts</p>
                        <p className="text-xl font-semibold">{unreadNotificationsCount}</p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="documents" className="mt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <Button variant="outline" className="justify-start" onClick={() => navigate("/student/pre-siwes")}>Pre-SIWES Form</Button>
                    <Button variant="outline" className="justify-start" onClick={() => navigate("/student/notifications")}>Announcements & Notices</Button>
                    {allWeeksCompleted && studentInfo?.id ? (
                      <PDFDownloadButton studentId={studentInfo.id as string} type="student" />
                    ) : (
                      <Button variant="outline" className="justify-start" disabled>Summary PDF (after week 24)</Button>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="timeline" className="mt-4">
                  <div className="space-y-3">
                    {timeline.map((item) => (
                      <div key={item.label} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                        <div className="flex items-center gap-3">
                          {item.done ? <CheckCircle className="h-4 w-4 text-success" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
                          <p className="text-sm font-medium">{item.label}</p>
                        </div>
                        <Badge variant={item.done ? "default" : "outline"}>{item.note}</Badge>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="support" className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card className="border-border/60">
                    <CardHeader>
                      <CardTitle className="text-base">Supervisor Contact</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <p><span className="text-muted-foreground">Name:</span> {studentInfo?.school_supervisor_name || "Not assigned"}</p>
                      <p><span className="text-muted-foreground">Email:</span> {studentInfo?.school_supervisor_email || "Not available"}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-border/60">
                    <CardHeader>
                      <CardTitle className="text-base">Help Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => setChatOpen(true)} disabled={!studentInfo?.school_supervisor_name || !isApproved || siwesLocked}>Chat Supervisor</Button>
                      <Button variant="outline" onClick={() => navigate("/student/profile/edit")}>Edit Profile</Button>
                      <Button variant="outline" onClick={() => navigate("/student/notifications")}>Open Notifications</Button>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {hasRegistration && (
            <Card className="border-border/60 bg-card/80 shadow-card">
              <CardContent className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 py-5">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Pre-SIWES Registration</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant={registrationStatusTone as any} className="px-3 py-1 text-sm">
                      {registrationStatusLabel}
                    </Badge>
                    <p className="text-sm text-muted-foreground">
                      {isApproved
                        ? "Your supervisor has approved the form."
                        : isRejected
                          ? "Review the remarks, make corrections, and resubmit."
                          : "Your submission is waiting for supervisor review."}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => navigate("/student/pre-siwes")}>
                    View Registration
                  </Button>
                  {!siwesLocked && (
                    <Button variant="outline" onClick={() => navigate("/student/pre-siwes/edit")}>
                      Edit Registration
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {!hasRegistration ? (
            <Card className="shadow-card border-2 border-primary/20 transition-all duration-300 ease-out hover:shadow-elevated">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-6 w-6 text-primary" />
                  <span>Complete Pre-SIWES Registration</span>
                </CardTitle>
                <CardDescription>
                  You must complete the Pre-SIWES registration form before accessing your logbook
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => navigate("/student/pre-siwes")}>
                  Go to Registration Form
                </Button>
              </CardContent>
            </Card>
          ) : isRejected ? (
            <Card className="shadow-card border-2 border-destructive/20 bg-destructive/10 transition-all duration-300 ease-out hover:shadow-elevated">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-destructive">
                  <XCircle className="h-6 w-6" />
                  <span>Pre-Registration Rejected</span>
                </CardTitle>
                <CardDescription>
                  Your pre-registration form has been reviewed and rejected by your school supervisor.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {rejectionReason && (
                  <div className="p-3 bg-destructive/20 border border-destructive/30 rounded-md">
                    <p className="text-sm font-medium text-destructive mb-1">Rejection Reason:</p>
                    <p className="text-sm text-destructive">{rejectionReason}</p>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  Please review the rejection reason above, update your registration form, and resubmit for approval.
                </p>
                <Button onClick={() => navigate("/student/pre-siwes")} variant="outline">
                  Update Registration Form
                </Button>
              </CardContent>
            </Card>
          ) : !isApproved ? (
            <Card className="shadow-card border-2 border-accent/20 bg-accent/10 transition-all duration-300 ease-out hover:shadow-elevated">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-muted-foreground">
                  <Clock className="h-6 w-6" />
                  <span>Pre-Registration Submitted</span>
                </CardTitle>
                <CardDescription>
                  Your pre-registration form has been submitted and is awaiting school supervisor approval.
                  You will be able to start weekly submissions once approved.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => navigate("/student/pre-siwes")} variant="outline">
                  View Registration Details
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {siwesLocked && (
                <Card className="shadow-elevated border-2 border-primary/20 bg-primary/5 transition-all duration-300 ease-out">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-primary">
                      <Lock className="h-6 w-6" />
                      SIWES Completed - Account Locked
                    </CardTitle>
                    <CardDescription className="text-primary">
                      Your SIWES has been completed and graded. Your account is now in read-only mode.
                      No further edits to weekly reports or attendance are allowed.
                    </CardDescription>
                  </CardHeader>
                  {gradeInfo && (
                    <CardContent>
                      <div className="bg-card rounded-lg p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-lg flex items-center gap-2">
                            <Award className="h-5 w-5 text-primary" />
                            Final Grade
                          </h3>
                          <Badge className={`text-lg px-3 py-1 ${
                            gradeInfo.grade === 'A' ? 'bg-success' :
                            gradeInfo.grade === 'B' ? 'bg-primary/100' :
                            gradeInfo.grade === 'C' ? 'bg-accent/100' :
                            gradeInfo.grade === 'D' ? 'bg-orange-600' :
                            'bg-destructive/100'
                          }`}>
                            {gradeInfo.grade}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-4 gap-4 text-center">
                          <div className="p-2 bg-primary/10 rounded">
                            <div className="text-2xl font-bold text-primary/80">{gradeInfo.attendanceScore.toFixed(1)}</div>
                            <div className="text-xs text-muted-foreground">Attendance /10</div>
                          </div>
                          <div className="p-2 bg-green-50 rounded">
                            <div className="text-2xl font-bold text-success">{gradeInfo.weeklyReportsScore.toFixed(1)}</div>
                            <div className="text-xs text-muted-foreground">Reports /15</div>
                          </div>
                          <div className="p-2 bg-primary/5 rounded">
                            <div className="text-2xl font-bold text-primary">{gradeInfo.supervisorApprovalScore.toFixed(1)}</div>
                            <div className="text-xs text-muted-foreground">Approval /5</div>
                          </div>
                          <div className="p-2 bg-muted rounded">
                            <div className="text-2xl font-bold text-foreground">{gradeInfo.totalScore.toFixed(1)}</div>
                            <div className="text-xs text-muted-foreground">Total /30</div>
                          </div>
                        </div>

                        {gradeInfo.remarks && (
                          <div className="pt-2 border-t">
                            <p className="text-sm text-muted-foreground">Supervisor Remarks:</p>
                            <p className="text-sm">{gradeInfo.remarks}</p>
                          </div>
                        )}

                        <div className="pt-2">
                          <PDFDownloadButton studentId={studentInfo?.id as string} type="student" />
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              {studentInfo && (
                <Card className="shadow-elevated transition-all duration-300 ease-out hover:shadow-card xl:col-span-5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      Training Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Organisation</p>
                      <p className="font-medium">{studentInfo.organisation_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Training Period</p>
                      <p className="font-medium">{studentInfo.period_of_training}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Industry Supervisor</p>
                      <p className="font-medium">{studentInfo.industry_supervisor_name}</p>
                      {studentInfo.industry_supervisor_email && (
                        <p className="text-xs text-muted-foreground">{studentInfo.industry_supervisor_email}</p>
                      )}
                      <div className="mt-2">
                        {studentInfo.industry_supervisor_signature_url ? (
                          <Badge variant="outline" className="bg-green-50 text-success border-green-200">
                            <CheckCircle className="w-3 h-3 mr-1" /> Signature Added
                          </Badge>
                        ) : (
                          <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowIndustrySignaturePad(true)}>
                            Add Signature
                          </Button>
                        )}
                      </div>
                    </div>
                    {studentInfo.school_supervisor_name && (
                      <div>
                        <p className="text-sm text-muted-foreground">School Supervisor</p>
                        <p className="font-medium">{studentInfo.school_supervisor_name}</p>
                        {studentInfo.school_supervisor_email && (
                          <p className="text-xs text-muted-foreground">{studentInfo.school_supervisor_email}</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card className="shadow-elevated transition-all duration-300 ease-out hover:shadow-card xl:col-span-7">
                <CardHeader>
                  <CardTitle>Weekly Progress</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Overall Completion</span>
                      <span className="font-bold text-primary">{completionPercentage}%</span>
                    </div>
                    <Progress value={completionPercentage} className="h-3" />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                    <Card className="border-2 border-blue-200 bg-primary/10 transition-all duration-300 ease-out hover:-translate-y-0.5"><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-2xl font-bold text-primary/80">{stats.submitted}</p><p className="text-sm text-primary/80 mt-1">Submitted</p></div><Clock className="h-8 w-8 text-primary/80" /></div></CardContent></Card>
                    <Card className="border-2 border-green-200 bg-green-50 transition-all duration-300 ease-out hover:-translate-y-0.5"><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-2xl font-bold text-success">{stats.approved}</p><p className="text-sm text-success mt-1">Approved</p></div><CheckCircle className="h-8 w-8 text-success" /></div></CardContent></Card>
                    <Card className="border-2 border-destructive/20 bg-destructive/10 transition-all duration-300 ease-out hover:-translate-y-0.5"><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-2xl font-bold text-destructive">{stats.rejected}</p><p className="text-sm text-destructive mt-1">Rejected</p></div><XCircle className="h-8 w-8 text-destructive" /></div></CardContent></Card>
                    <Card className="border-2 border-border bg-muted transition-all duration-300 ease-out hover:-translate-y-0.5"><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-2xl font-bold text-muted-foreground">{stats.pending}</p><p className="text-sm text-muted-foreground mt-1">Pending</p></div><Calendar className="h-8 w-8 text-muted-foreground" /></div></CardContent></Card>
                  </div>
                </CardContent>
              </Card>

              {allWeeksCompleted && studentInfo && (
                <Card className="shadow-elevated border-2 border-green-200 bg-green-50 transition-all duration-300 ease-out hover:shadow-card xl:col-span-12">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-success">
                      <CheckCircle className="h-6 w-6" />
                      All 24 Weeks Completed!
                    </CardTitle>
                    <CardDescription>Download your SIWES summary PDF to take to ITF</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {studentInfo.id && <PDFDownloadButton studentId={studentInfo.id as string} type="student" />}
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 xl:col-span-12">
                <Button onClick={() => navigate("/student/logbook")} className="h-28 flex-col gap-2 transition-all duration-300 ease-out hover:-translate-y-0.5" size="lg" disabled={!isApproved || siwesLocked} variant={siwesLocked ? "outline" : "default"}>
                  {siwesLocked ? <Lock className="h-7 w-7" /> : <BookOpen className="h-7 w-7" />}
                  <span>{siwesLocked ? "View Logbook (Read-Only)" : "My Logbook"}</span>
                  {!isApproved && !siwesLocked && <span className="text-xs text-muted-foreground">(Awaiting approval)</span>}
                </Button>

                <Button
                  onClick={() => setChatOpen(true)}
                  className="h-28 flex-col gap-2 transition-all duration-300 ease-out hover:-translate-y-0.5"
                  size="lg"
                  disabled={!isApproved || siwesLocked || !studentInfo?.school_supervisor_name}
                  variant="outline"
                  title="Chat with your assigned supervisor"
                >
                  <div className="relative h-8 w-8 flex items-center justify-center">
                    <MessageCircle className="h-7 w-7 text-primary" />
                  </div>
                  <span>Chat with Supervisor</span>
                  {!studentInfo?.school_supervisor_name && (
                    <span className="text-xs text-muted-foreground">(No supervisor assigned)</span>
                  )}
                </Button>

                <Button onClick={() => navigate("/student/notifications")} variant="outline" className="relative h-28 flex-col gap-2 transition-all duration-300 ease-out hover:-translate-y-0.5" size="lg">
                  <div className="relative">
                    <Bell className="h-7 w-7" />
                    {unreadNotificationsCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                        {unreadNotificationsCount > 9 ? "9+" : unreadNotificationsCount}
                      </span>
                    )}
                  </div>
                  <span>Notifications</span>
                </Button>

                <Button onClick={() => navigate("/student/pre-siwes")} variant="outline" className="h-28 flex-col gap-2 transition-all duration-300 ease-out hover:-translate-y-0.5" size="lg" disabled={siwesLocked}>
                  <FileText className="h-7 w-7" />
                  <span>View Registration</span>
                </Button>
              </div>
              </div>

              <SupervisorStudentChatDrawer
                open={chatOpen}
                onClose={() => setChatOpen(false)}
                supervisorId={
                  studentInfo?.school_supervisor_id
                  || studentInfo?.supervisor_id
                  || (studentInfo?.supervisor_assignments && Array.isArray(studentInfo.supervisor_assignments)
                        ? studentInfo.supervisor_assignments[0]?.supervisor_id
                        : undefined)
                }
                student={{
                  id: studentInfo?.id,
                  name: profile?.full_name,
                  matric_number: studentInfo?.matric_no,
                }}
                supervisorInfo={{
                  name: studentInfo?.school_supervisor_name,
                  email: studentInfo?.school_supervisor_email,
                  photo: studentInfo?.school_supervisor_photo_url || undefined,
                }}
              />
            </>
          )}

          {/* Dialog for Industry Signature Pad (unchanged) */}
          <Dialog open={showIndustrySignaturePad} onOpenChange={setShowIndustrySignaturePad}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Industry Supervisor Signature</DialogTitle>
              </DialogHeader>
              <SignaturePad 
                onSignatureComplete={handleUploadIndustrySignature}
                onCancel={() => setShowIndustrySignaturePad(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard;
