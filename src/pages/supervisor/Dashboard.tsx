import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, FileCheck, Clock, CheckCircle, Eye } from "lucide-react";
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
  }[];
}

const SupervisorDashboard = () => {
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
    if (userRole && !["industry_supervisor", "school_supervisor"].includes(userRole)) {
      navigate("/");
    }
  }, [userRole, navigate]);

  useEffect(() => {
    if (profile?.role && user) {
      fetchStudentsAndSubmissions();
    }
  }, [profile, user]);

  const fetchStudentsAndSubmissions = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Get supervisor's email from profiles
      const { data: supervisorProfile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      // Get supervisor record to find their email
      const { data: supervisorData, error: supervisorError } = await supabase
        .from("supervisors")
        .select("email")
        .eq("user_id", user.id)
        .maybeSingle();

      const supervisorEmail = supervisorData?.email;

      // Fetch all students assigned to this supervisor
      const { data: studentsData, error: studentsError } = await supabase
        .from("students")
        .select(`
          id,
          matric_no,
          department,
          period_of_training,
          organisation_name,
          industry_supervisor_email,
          user_id
        `)
        .eq("industry_supervisor_email", supervisorEmail || "");

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

      // Fetch weeks for these students
      const studentIds = studentsData.map(s => s.id);
      const { data: weeksData, error: weeksError } = await supabase
        .from("weeks")
        .select("*")
        .in("student_id", studentIds)
        .order("week_number", { ascending: false });

      if (weeksError) throw weeksError;

      // Combine data
      const studentsWithWeeks = studentsData.map(student => {
        const profile = profilesData?.find(p => p.id === student.user_id);
        const weeks = weeksData?.filter(w => w.student_id === student.id) || [];
        return {
          ...student,
          profile: { full_name: profile?.full_name || "Unknown" },
          weeks
        };
      });

      setStudents(studentsWithWeeks);

      // Calculate stats
      const totalStudents = studentsWithWeeks.length;
      const allWeeks = weeksData || [];
      const pendingReviews = allWeeks.filter(w => w.status === "submitted").length;
      const approved = allWeeks.filter(w => w.status === "approved").length;
      
      // This week submissions
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const thisWeek = allWeeks.filter(w => 
        w.submitted_at && new Date(w.submitted_at) >= oneWeekAgo
      ).length;

      setStats({
        totalStudents,
        pendingReviews,
        approved,
        thisWeek
      });
    } catch (error: any) {
      toast.error("Error loading dashboard data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "secondary",
      submitted: "default",
      approved: "default",
      rejected: "destructive",
    };

    return (
      <Badge variant={variants[status] || "outline"} className="capitalize">
        {status}
      </Badge>
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
        <div className="max-w-6xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-primary mb-2">Supervisor Dashboard</h1>
            <p className="text-muted-foreground">Review and approve student submissions</p>
          </div>

          <div className="grid md:grid-cols-4 gap-4">
            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Users className="h-8 w-8 text-primary" />
                  <span className="text-3xl font-bold">{stats.totalStudents}</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Total Students</p>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Clock className="h-8 w-8 text-primary" />
                  <span className="text-3xl font-bold">{stats.pendingReviews}</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Pending Reviews</p>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CheckCircle className="h-8 w-8 text-primary" />
                  <span className="text-3xl font-bold">{stats.approved}</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Approved</p>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <FileCheck className="h-8 w-8 text-primary" />
                  <span className="text-3xl font-bold">{stats.thisWeek}</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">This Week</p>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Pending Submissions</CardTitle>
              <CardDescription>Student weekly reports awaiting your review</CardDescription>
            </CardHeader>
            <CardContent>
              {students.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No students assigned to you yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {students.map(student => {
                    const pendingWeeks = student.weeks.filter(w => w.status === "submitted");
                    if (pendingWeeks.length === 0) return null;

                    return (
                      <div key={student.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold">{student.profile.full_name}</h4>
                            <p className="text-sm text-muted-foreground">{student.matric_no} • {student.department}</p>
                          </div>
                          <Badge>{pendingWeeks.length} pending</Badge>
                        </div>
                        
                        <div className="space-y-2">
                          {pendingWeeks.slice(0, 3).map(week => (
                            <div key={week.id} className="flex items-center justify-between p-3 bg-muted/50 rounded">
                              <div className="flex items-center space-x-3">
                                <div>
                                  <p className="font-medium">Week {week.week_number}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Submitted {week.submitted_at ? format(new Date(week.submitted_at), "MMM dd, yyyy") : "N/A"}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                {getStatusBadge(week.status)}
                                <Button 
                                  size="sm" 
                                  onClick={() => navigate(`/supervisor/week/${week.id}`)}
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  Review
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }).filter(Boolean)}

                  {students.every(s => s.weeks.filter(w => w.status === "submitted").length === 0) && (
                    <div className="text-center py-12 text-muted-foreground">
                      <FileCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No pending submissions at this time</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default SupervisorDashboard;
