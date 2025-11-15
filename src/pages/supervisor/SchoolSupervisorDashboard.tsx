import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileCheck, Clock, CheckCircle, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface StudentWithWeeks {
  id: string;
  matric_no: string;
  department: string;
  period_of_training: string;
  organisation_name: string;
  user_id: string;
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
  }[];
}

const SchoolSupervisorDashboard = () => {
  const { userRole, profile, user } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<StudentWithWeeks[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    if (profile?.role && user) {
      fetchForwardedSubmissions();
    }
  }, [profile, user]);

  const fetchForwardedSubmissions = async () => {
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
          period_of_training,
          organisation_name,
          school_supervisor_email,
          user_id
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

      // Fetch weeks that have been forwarded to school
      const studentIds = studentsData.map(s => s.id);
      const { data: weeksData, error: weeksError } = await supabase
        .from("weeks")
        .select("*")
        .in("student_id", studentIds)
        .eq("forwarded_to_school", true)
        .order("week_number", { ascending: false });

      if (weeksError) throw weeksError;

      // Combine data
      const studentsWithWeeks = studentsData.map(student => {
        const profile = profilesData?.find(p => p.id === student.user_id);
        const weeks = weeksData?.filter(w => w.student_id === student.id) || [];
        return {
          ...student,
          profile: profile || { full_name: 'Unknown' },
          weeks,
        };
      });

      setStudents(studentsWithWeeks);

      // Calculate stats
      const totalStudents = studentsWithWeeks.length;
      const allWeeks = weeksData || [];
      const pendingReviews = allWeeks.filter(w => w.forwarded_to_school && !w.school_approved_at).length;
      const approved = allWeeks.filter(w => w.school_approved_at).length;
      
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
    } catch (error: any) {
      toast.error("Error loading submissions");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string, forwarded: boolean) => {
    if (!forwarded) return null;
    
    switch (status) {
      case "submitted":
        return <Badge variant="default">Pending Review</Badge>;
      case "approved":
        return <Badge className="bg-green-500">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">School Supervisor Dashboard</h1>
          <p className="text-muted-foreground">
            Review student submissions forwarded by industry supervisors
          </p>
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

        {/* Forwarded Submissions */}
        <Card>
          <CardHeader>
            <CardTitle>Forwarded Weekly Reports</CardTitle>
            <CardDescription>
              Review and approve reports stamped by industry supervisors
            </CardDescription>
          </CardHeader>
          <CardContent>
            {students.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No students assigned yet
              </p>
            ) : (
              <div className="space-y-6">
                {students.map((student) => {
                  const forwardedWeeks = student.weeks.filter(w => w.forwarded_to_school);
                  
                  if (forwardedWeeks.length === 0) return null;

                  return (
                    <div key={student.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-lg">{student.profile.full_name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {student.matric_no} • {student.department}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {student.organisation_name}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">Forwarded Reports:</h4>
                        {forwardedWeeks.map((week) => (
                          <div
                            key={week.id}
                            className="flex items-center justify-between p-3 bg-muted/50 rounded-md"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">Week {week.week_number}</span>
                                {getStatusBadge(week.status, week.forwarded_to_school)}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(week.start_date), "MMM d")} - {format(new Date(week.end_date), "MMM d, yyyy")}
                              </p>
                              {week.submitted_at && (
                                <p className="text-xs text-muted-foreground">
                                  Forwarded: {format(new Date(week.submitted_at), "MMM d, yyyy h:mm a")}
                                </p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              onClick={() => navigate(`/supervisor/week/${week.id}`)}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              Review
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SchoolSupervisorDashboard;
