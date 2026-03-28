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
import { FileText, BookOpen, Calendar, CheckCircle, XCircle, Clock, Building, ArrowLeft, Lock, Award, Bell, Briefcase, GraduationCap, Laptop, Route, Map, FileSignature } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { PDFDownloadButton } from "@/components/PDFDownloadButton";
import SupervisorStudentChatDrawer from "@/components/SupervisorStudentChatDrawer";
import { usePortalStatus } from "@/hooks/usePortalStatus";
import PortalClosed from "./PortalClosed";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { StudentNotifications } from "@/components/student/StudentNotifications";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SignaturePad } from "@/components/SignaturePad";

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
  const [studentInfo, setStudentInfo] = useState<Record<string, unknown> | null>(null);
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

  // Fetch unread announcements count
  const { data: unreadAnnouncementsCount = 0 } = useQuery({
    queryKey: ["student", "unread-announcements", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      
      const lastReadISO = localStorage.getItem(`lastReadAnnouncementTime_${user.id}`);
      
      let query = supabase
        .from("announcements")
        .select("id", { count: "exact", head: true });
        
      if (lastReadISO) {
        query = query.gt("created_at", lastReadISO);
      }
      
      const { count, error } = await query;
      if (error) {
        console.error("Error fetching unread announcements count:", error);
        return 0;
      }
      
      return count || 0;
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
      
      // 1. Fetch Student Data & Pre-Registration in ONE query
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select(`
          *,
          pre_registration (
            status,
            remark
          )
        `)
        .eq("user_id", user?.id)
        .maybeSingle();

      if (studentError && studentError.code !== 'PGRST116') throw studentError;

      setHasRegistration(!!studentData);
      
      let enrichedStudentData = studentData;
      if (studentData) {
        // ALWAYS try to get the supervisor assignment to ensure we have the ID for chat
        const { data: assignment } = await supabase
          .from("supervisor_assignments")
          .select("supervisor_id, supervisors(name, email)")
          .eq("student_id", studentData.id)
          .eq("assignment_type", "school_supervisor")
          .maybeSingle();
        
        if (assignment && assignment.supervisor_id) {
          enrichedStudentData = {
            ...studentData,
            school_supervisor_id: assignment.supervisor_id,
            school_supervisor_name: assignment.supervisors?.name || studentData.school_supervisor_name,
            school_supervisor_email: assignment.supervisors?.email || studentData.school_supervisor_email,
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
        const preReg = Array.isArray(studentData.pre_registration) 
          ? studentData.pre_registration[0] 
          : studentData.pre_registration;

        const status = preReg?.status || 'pending';
        setIsApproved(status === 'approved');
        setIsRejected(status === 'rejected');
        setRejectionReason(preReg?.remark || null);

        // Check if SIWES is locked (after grading)
        setSiwesLocked(studentData.siwes_locked === true);

        // If locked, fetch grade information
        if (studentData.siwes_locked === true) {
          const { data: gradeData } = await supabase
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

        const approvedWeeks = weeksData?.filter(w => w.status === "approved").length || 0;
        setAllWeeksCompleted(approvedWeeks >= 24);
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
      const { error: updateError } = await supabase
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

  return (
    <div className="min-h-screen bg-background relative z-0">
      <StudentBackgroundIcons />
      <Navbar />

      <main className="container mx-auto px-4 py-8 relative z-10">
        <div className="max-w-6xl mx-auto space-y-6">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="mb-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you leaving?</AlertDialogTitle>
                <AlertDialogDescription>
                  For your security, would you like to sign out before leaving the dashboard, or just return to the home page?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex flex-col sm:flex-row gap-2 mt-2">
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <Button variant="outline" onClick={() => navigate("/")}>Just Go Home</Button>
                <AlertDialogAction onClick={() => signOut()} className="bg-primary hover:bg-primary/90">
                  Sign Out & Leave
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-primary">
                Welcome back, {profile?.full_name || "Student"}!
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-1">
                {siwesLocked 
                  ? "Your SIWES has been completed and graded. View your final results below."
                  : "Track your SIWES progress and manage your weekly logbook"
                }
              </p>
            </div>
            {!siwesLocked && (
              <div className="flex gap-2 self-start sm:self-auto">
                <Button variant="outline" size="sm" className="sm:size-default" onClick={() => navigate("/student/profile/edit")}>
                  Edit Profile
                </Button>
                <Button variant="outline" onClick={() => navigate("/student/pre-siwes/edit")}>
                  Edit Registration
                </Button>
              </div>
            )}
          </div>

          {/* Student Notifications */}
          <StudentNotifications />

          {!hasRegistration ? (
            <Card className="shadow-card border-2 border-primary/20">
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
            <Card className="shadow-card border-2 border-destructive/20 bg-destructive/10">
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
            <Card className="shadow-card border-2 border-accent/20 bg-accent/10">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-muted-foreground">
                  <Clock className="h-6 w-6" />
                  <span>Pre-Registration Pending Approval</span>
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
              {/* SIWES Locked Banner */}
              {siwesLocked && (
                <Card className="shadow-elevated border-2 border-primary/20 bg-primary/5">
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
                          <PDFDownloadButton 
                            studentId={studentInfo?.id as string} 
                            type="student"
                          />
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              )}

              {/* System Information Cards */}
              <div className="grid md:grid-cols-2 gap-4">
              </div>

              {studentInfo && (
                <Card className="shadow-elevated">
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
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-xs"
                            onClick={() => setShowIndustrySignaturePad(true)}
                          >
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

              <Card className="shadow-elevated">
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
                    <Card className="border-2 border-blue-200 bg-primary/10">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-2xl font-bold text-primary/80">{stats.submitted}</p>
                            <p className="text-sm text-primary/80 mt-1">Submitted</p>
                          </div>
                          <Clock className="h-8 w-8 text-primary/80" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-2 border-green-200 bg-green-50">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-2xl font-bold text-success">{stats.approved}</p>
                            <p className="text-sm text-success mt-1">Approved</p>
                          </div>
                          <CheckCircle className="h-8 w-8 text-success" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-2 border-destructive/20 bg-destructive/10">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-2xl font-bold text-destructive">{stats.rejected}</p>
                            <p className="text-sm text-destructive mt-1">Rejected</p>
                          </div>
                          <XCircle className="h-8 w-8 text-destructive" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-2 border-border bg-muted">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-2xl font-bold text-muted-foreground">{stats.pending}</p>
                            <p className="text-sm text-muted-foreground mt-1">Pending</p>
                          </div>
                          <Calendar className="h-8 w-8 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>

              {allWeeksCompleted && studentInfo && (
                <Card className="shadow-elevated border-2 border-green-200 bg-green-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-success">
                      <CheckCircle className="h-6 w-6" />
                      All 24 Weeks Completed!
                    </CardTitle>
                    <CardDescription>
                      Download your SIWES summary PDF to take to ITF
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <PDFDownloadButton 
                      studentId={studentInfo.id} 
                      type="student"
                    />
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Button 
                  onClick={() => navigate("/student/logbook")} 
                  className="h-24 flex-col gap-2"
                  size="lg"
                  disabled={!isApproved || siwesLocked}
                  variant={siwesLocked ? "outline" : "default"}
                >
                  {siwesLocked ? <Lock className="h-6 w-6" /> : <BookOpen className="h-6 w-6" />}
                  <span>{siwesLocked ? "View Logbook (Read-Only)" : "My Logbook"}</span>
                  {!isApproved && !siwesLocked && (
                    <span className="text-xs text-muted-foreground">(Awaiting approval)</span>
                  )}
                </Button>

                {/* Chat Button for Supervisor ↔ Student */}
                <Button
                  onClick={() => setChatOpen(true)}
                  className="h-24 flex-col gap-2"
                  size="lg"
                  disabled={!isApproved || siwesLocked || !studentInfo?.school_supervisor_name}
                  variant="outline"
                  title="Chat with your assigned supervisor"
                >
                  <span className="text-2xl">💬</span>
                  <span>Chat with Supervisor</span>
                  {!studentInfo?.school_supervisor_name && (
                    <span className="text-xs text-muted-foreground">(No supervisor assigned)</span>
                  )}
                </Button>
                <Button 
                  onClick={() => navigate("/student/announcements")}
                  variant="outline"
                    className="relative h-24 flex-col gap-2"
                    size="lg"
                  >
                    <div className="relative">
                      <Bell className="h-6 w-6" />
                      {unreadAnnouncementsCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                          {unreadAnnouncementsCount > 9 ? "9+" : unreadAnnouncementsCount}
                        </span>
                      )}
                    </div>
                    <span>Announcements</span>
                  </Button>

                <Button 
                  onClick={() => navigate("/student/pre-siwes")} 
                  variant="outline"
                  className="h-24 flex-col gap-2"
                  size="lg"
                  disabled={siwesLocked}
                >
                  <FileText className="h-6 w-6" />
                  <span>View Registration</span>
                </Button>

              </div>

              {/* Supervisor ↔ Student Chat Drawer */}
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
