import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileCheck, Clock, CheckCircle, ArrowLeft, Users, CalendarCheck, CalendarRange, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { PrintableStudentsTable } from "@/components/supervisor/PrintableStudentsTable";
import { StudentAttendanceTabsView } from "@/components/supervisor/StudentAttendanceTabsView";
import { StudentTabsView } from "@/components/supervisor/StudentTabsView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/utils/api";

interface StudentWithWeeks {
  id: string;
  matric_no: string;
  department: string;
  faculty?: string;
  level?: string;
  period_of_training: string;
  organisation_name: string;
  user_id: string;
  full_name?: string;
  profile: {
    full_name: string;
  };
  weeks: {
    id: string;
    week_number: number;
    status: string;
    submitted_at: string | null;
    start_date: string;
    end_date: string;
    forwarded_to_school: boolean;
    score?: number | null;
    school_supervisor_approved_at?: string | null;
    school_supervisor_comments?: string | null;
  }[];
}

const SchoolSupervisorDashboard = () => {
  const { userRole, profile, user } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<StudentWithWeeks[]>([]);
  const [loading, setLoading] = useState(true);
  const [compilingLogbook, setCompilingLogbook] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalStudents: 0,
    pendingReviews: 0,
    approved: 0,
    thisWeek: 0
  });

  useEffect(() => {
    if (userRole && userRole !== "school_supervisor") {
      navigate("/");
    }
  }, [userRole, navigate]);

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



  const fetchForwardedSubmissions = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Get supervisor's email from supervisors table
      const { data: supervisorData, error: supervisorError } = await supabase
        .from("supervisors")
        .select("email")
        .eq("user_id", user.id)
        .eq("supervisor_type", "school_supervisor")
        .maybeSingle();

      const supervisorEmail = supervisorData?.email;

      if (!supervisorEmail) {
        setStudents([]);
        setLoading(false);
        return;
      }

      // Fetch students assigned to this school supervisor
      const { data: studentsData, error: studentsError } = await supabase
        .from("students")
        .select(`
          id,
          matric_no,
          department,
          faculty,
          full_name,
          period_of_training,
          organisation_name,
          school_supervisor_email,
          user_id,
          profile_image_url
        `)
        .eq("school_supervisor_email", supervisorEmail);

      if (studentsError) throw studentsError;

      if (!studentsData || studentsData.length === 0) {
        setStudents([]);
        setLoading(false);
        return;
      }


      // Fetch profiles for students
      const userIds = studentsData.map(s => s.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // Fetch weeks that are submitted, approved, or rejected (all reviewed/reviewable by school supervisor)
      const studentIds = studentsData.map(s => s.id);
      const { data: weeksData, error: weeksError } = await supabase
        .from("weeks")
        .select("*")
        .in("student_id", studentIds)
        .in("status", ["submitted", "approved", "rejected"])
        .order("week_number", { ascending: false });

      if (weeksError) throw weeksError;

      // Combine data - also get full_name from students table as fallback
      const studentsWithWeeks = studentsData.map(student => {
        const profile = profilesData?.find(p => p.id === student.user_id);
        const weeks = weeksData?.filter(w => w.student_id === student.id) || [];
        return {
          ...student,
          profile: profile || { full_name: student.full_name || 'Unknown' },
          weeks,
        };
      });

      setStudents(studentsWithWeeks);

      // Calculate stats
      const totalStudents = studentsWithWeeks.length;
      const allWeeks = weeksData || [];
      const pendingReviews = allWeeks.filter(w => w.status === "submitted" && !w.school_approved_at).length;
      const approved = allWeeks.filter(w => w.status === "approved").length;
      
      const today = new Date();
      const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 1));
      const thisWeek = allWeeks.filter(w => {
        const submittedDate = w.submitted_at ? new Date(w.submitted_at) : null;
        return submittedDate && submittedDate >= startOfWeek;
      }).length;

      setStats({
        totalStudents,
        pendingReviews,
        approved,
        thisWeek
      });
    } catch (error: unknown) {
      toast.error("Error loading submissions");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (profile?.role && user) {
      fetchForwardedSubmissions();
    }
  }, [profile, user, fetchForwardedSubmissions]);

  // Handle Compile Logbook - generates complete 24-week PDF
  const handleCompileLogbook = async (studentId: string, studentName: string) => {
    setCompilingLogbook(studentId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Authentication required");
        return;
      }

      const response = await apiRequest('/api/pdf/compile-logbook', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ studentId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to compile logbook');
      }

      // Download the PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SIWES_Logbook_${studentName.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success("Logbook compiled and downloaded successfully!");
    } catch (error) {
      console.error("Compile logbook error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to compile logbook");
    } finally {
      setCompilingLogbook(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading submissions...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Button>
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">School Supervisor Dashboard</h1>
            <p className="text-muted-foreground">
              Review student submissions forwarded by industry supervisors
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/profile/edit")}>
            Edit Profile
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <FileCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalStudents}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingReviews}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.approved}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Week</CardTitle>
              <FileCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.thisWeek}</div>
            </CardContent>
          </Card>
        </div>

        {/* Session Information Cards */}
        {(acceptanceDate || attachmentPeriod) && (
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            {acceptanceDate && (
              <Card className="border-2 border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-800 text-base">
                    <CalendarCheck className="h-5 w-5" />
                    Acceptance Letter Deadline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-bold text-blue-900">
                    {format(new Date(acceptanceDate as string), "EEEE, MMMM dd, yyyy")}
                  </p>
                </CardContent>
              </Card>
            )}

            {attachmentPeriod && typeof attachmentPeriod === 'object' && (attachmentPeriod as {from_date?: string; to_date?: string}).from_date && (attachmentPeriod as {from_date?: string; to_date?: string}).to_date && (
              <Card className="border-2 border-green-200 bg-green-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-800 text-base">
                    <CalendarRange className="h-5 w-5" />
                    Period of Attachment
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date((attachmentPeriod as {from_date: string}).from_date), "MMM dd, yyyy")} - {format(new Date((attachmentPeriod as {to_date: string}).to_date), "MMM dd, yyyy")}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Printable Students Table */}
        {students.length > 0 && (
          <div className="mb-8">
            <PrintableStudentsTable 
              students={students}
              supervisorName={profile?.full_name || "School Supervisor"}
              title="Students Under Supervision"
            />
          </div>
        )}

        {/* Tabs for Reports and Attendance */}
        <Tabs defaultValue="reports" className="space-y-4">
          <TabsList>
            <TabsTrigger value="reports">
              <FileCheck className="h-4 w-4 mr-2" />
              Weekly Reports
            </TabsTrigger>
            <TabsTrigger value="attendance">
              <Calendar className="h-4 w-4 mr-2" />
              Attendance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reports">
            {/* Quick Actions */}
            <div className="flex gap-2 mb-4">
              <Button onClick={() => navigate("/supervisor/students")} variant="outline">
                <Users className="h-4 w-4 mr-2" />
                View All Students
              </Button>
              <Button onClick={() => navigate("/supervisor/pending-registrations")} variant="outline">
                <FileCheck className="h-4 w-4 mr-2" />
                Manage Registrations
              </Button>
            </div>
            
            {/* Student Tabs View with Full-Screen Reports */}
            <StudentTabsView 
              students={students}
              onRefresh={fetchForwardedSubmissions}
              onCompileLogbook={handleCompileLogbook}
              compilingLogbook={compilingLogbook}
            />
          </TabsContent>

          <TabsContent value="attendance">
            {/* Enhanced Attendance View with Student Tabs */}
            <StudentAttendanceTabsView />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SchoolSupervisorDashboard;
