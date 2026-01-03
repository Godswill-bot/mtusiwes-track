import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { FileText, BookOpen, Calendar, CheckCircle, XCircle, Clock, Building, ArrowLeft, CalendarCheck, CalendarRange, Lock, Award } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { PDFDownloadButton } from "@/components/PDFDownloadButton";
import { usePortalStatus } from "@/hooks/usePortalStatus";
import PortalClosed from "./PortalClosed";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { StudentNotifications } from "@/components/student/StudentNotifications";

const StudentDashboard = () => {
  const { user, userRole, profile } = useAuth();
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

  // Fetch acceptance letter date
  const { data: acceptanceDate } = useQuery({
    queryKey: ["system-settings", currentSession?.id, "acceptance_letter_date"],
    queryFn: async () => {
      if (!currentSession?.id) return null;
      const { data, error } = await supabase
        .from("system_settings")
        .select("setting_value")
        .eq("session_id", currentSession.id)
        .eq("setting_key", "acceptance_letter_date")
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data?.setting_value;
    },
    enabled: !!currentSession?.id,
  });

  // Fetch period of attachment
  const { data: attachmentPeriod } = useQuery({
    queryKey: ["system-settings", currentSession?.id, "attachment_period"],
    queryFn: async () => {
      if (!currentSession?.id) return null;
      const { data, error } = await supabase
        .from("system_settings")
        .select("setting_value")
        .eq("session_id", currentSession.id)
        .eq("setting_key", "attachment_period")
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data?.setting_value;
    },
    enabled: !!currentSession?.id,
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
      
      // If school_supervisor_name is null, try to fetch from supervisor_assignments
      let enrichedStudentData = studentData;
      if (studentData && !studentData.school_supervisor_name) {
        const { data: assignment } = await supabase
          .from("supervisor_assignments")
          .select("supervisors(name, email)")
          .eq("student_id", studentData.id)
          .eq("assignment_type", "school_supervisor")
          .maybeSingle();
        
        if (assignment?.supervisors) {
          enrichedStudentData = {
            ...studentData,
            school_supervisor_name: assignment.supervisors.name,
            school_supervisor_email: assignment.supervisors.email,
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

        // 2. Fetch Weeks Stats (Parallelizable if we didn't need student ID, but we do)
        const { data: weeksData } = await supabase
          .from("weeks")
          .select("status, week_number")
          .eq("student_id", studentData.id)
          .lte("week_number", 24);

        const totalWeeks = weeksData?.length || 0;
        const submitted = weeksData?.filter(w => w.status === "submitted").length || 0;
        const approved = weeksData?.filter(w => w.status === "approved").length || 0;
        const rejected = weeksData?.filter(w => w.status === "rejected").length || 0;
        const pending = weeksData?.filter(w => w.status === "draft").length || 0;

        setStats({
          totalWeeks,
          submitted,
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

  const completionPercentage = stats.totalWeeks > 0 
    ? Math.round((stats.approved / stats.totalWeeks) * 100) 
    : 0;

  return (
    <div className="min-h-screen bg-gradient-light">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-primary">
                Welcome back, {profile?.full_name || "Student"}!
              </h1>
              <p className="text-muted-foreground mt-1">
                {siwesLocked 
                  ? "Your SIWES has been completed and graded. View your final results below."
                  : "Track your SIWES progress and manage your weekly logbook"
                }
              </p>
            </div>
            {!siwesLocked && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => navigate("/student/profile/edit")}>
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
            <Card className="shadow-card border-2 border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-red-800">
                  <XCircle className="h-6 w-6" />
                  <span>Pre-Registration Rejected</span>
                </CardTitle>
                <CardDescription>
                  Your pre-registration form has been reviewed and rejected by your school supervisor.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {rejectionReason && (
                  <div className="p-3 bg-red-100 border border-red-300 rounded-md">
                    <p className="text-sm font-medium text-red-800 mb-1">Rejection Reason:</p>
                    <p className="text-sm text-red-700">{rejectionReason}</p>
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
            <Card className="shadow-card border-2 border-yellow-200 bg-yellow-50">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-yellow-800">
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
                <Card className="shadow-elevated border-2 border-purple-200 bg-purple-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-purple-800">
                      <Lock className="h-6 w-6" />
                      SIWES Completed - Account Locked
                    </CardTitle>
                    <CardDescription className="text-purple-700">
                      Your SIWES has been completed and graded. Your account is now in read-only mode.
                      No further edits to weekly reports or attendance are allowed.
                    </CardDescription>
                  </CardHeader>
                  {gradeInfo && (
                    <CardContent>
                      <div className="bg-white rounded-lg p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-lg flex items-center gap-2">
                            <Award className="h-5 w-5 text-purple-600" />
                            Final Grade
                          </h3>
                          <Badge className={`text-lg px-3 py-1 ${
                            gradeInfo.grade === 'A' ? 'bg-green-500' :
                            gradeInfo.grade === 'B' ? 'bg-blue-500' :
                            gradeInfo.grade === 'C' ? 'bg-yellow-500' :
                            gradeInfo.grade === 'D' ? 'bg-orange-500' :
                            'bg-red-500'
                          }`}>
                            {gradeInfo.grade}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-4 gap-4 text-center">
                          <div className="p-2 bg-blue-50 rounded">
                            <div className="text-2xl font-bold text-blue-600">{gradeInfo.attendanceScore.toFixed(1)}</div>
                            <div className="text-xs text-muted-foreground">Attendance /10</div>
                          </div>
                          <div className="p-2 bg-green-50 rounded">
                            <div className="text-2xl font-bold text-green-600">{gradeInfo.weeklyReportsScore.toFixed(1)}</div>
                            <div className="text-xs text-muted-foreground">Reports /15</div>
                          </div>
                          <div className="p-2 bg-purple-50 rounded">
                            <div className="text-2xl font-bold text-purple-600">{gradeInfo.supervisorApprovalScore.toFixed(1)}</div>
                            <div className="text-xs text-muted-foreground">Approval /5</div>
                          </div>
                          <div className="p-2 bg-gray-100 rounded">
                            <div className="text-2xl font-bold text-gray-800">{gradeInfo.totalScore.toFixed(1)}</div>
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
                {acceptanceDate && (
                  <Card className="shadow-elevated border-2 border-blue-200 bg-blue-50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-blue-800">
                        <CalendarCheck className="h-5 w-5" />
                        Acceptance Letter Submission
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-2">Submission Deadline</p>
                      <p className="text-lg font-bold text-blue-900">
                        {format(new Date(acceptanceDate), "EEEE, MMMM dd, yyyy")}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {attachmentPeriod && typeof attachmentPeriod === 'object' && attachmentPeriod.from_date && attachmentPeriod.to_date && (
                  <Card className="shadow-elevated border-2 border-green-200 bg-green-50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-green-800">
                        <CalendarRange className="h-5 w-5" />
                        Period of Attachment
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div>
                          <p className="text-sm text-muted-foreground">From</p>
                          <p className="font-bold text-green-900">
                            {format(new Date(attachmentPeriod.from_date), "MMMM dd, yyyy")}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">To</p>
                          <p className="font-bold text-green-900">
                            {format(new Date(attachmentPeriod.to_date), "MMMM dd, yyyy")}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
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
                    <Card className="border-2 border-blue-200 bg-blue-50">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-2xl font-bold text-blue-600">{stats.submitted}</p>
                            <p className="text-sm text-blue-600 mt-1">Submitted</p>
                          </div>
                          <Clock className="h-8 w-8 text-blue-400" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-2 border-green-200 bg-green-50">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
                            <p className="text-sm text-green-600 mt-1">Approved</p>
                          </div>
                          <CheckCircle className="h-8 w-8 text-green-400" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-2 border-red-200 bg-red-50">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
                            <p className="text-sm text-red-600 mt-1">Rejected</p>
                          </div>
                          <XCircle className="h-8 w-8 text-red-400" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-2 border-gray-200 bg-gray-50">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-2xl font-bold text-gray-600">{stats.pending}</p>
                            <p className="text-sm text-gray-600 mt-1">Pending</p>
                          </div>
                          <Calendar className="h-8 w-8 text-gray-400" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>

              {allWeeksCompleted && studentInfo && (
                <Card className="shadow-elevated border-2 border-green-200 bg-green-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-800">
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

              <div className="grid md:grid-cols-3 gap-4">
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
                <Button 
                  onClick={() => navigate("/student/attendance")}
                  variant="outline"
                  className="h-24 flex-col gap-2"
                  size="lg"
                  disabled={siwesLocked}
                >
                  {siwesLocked ? <Lock className="h-6 w-6" /> : <Calendar className="h-6 w-6" />}
                  <span>{siwesLocked ? "View Attendance (Read-Only)" : "My Attendance"}</span>
                </Button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard;
