import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { FileText, BookOpen, Calendar, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const StudentDashboard = () => {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const [hasRegistration, setHasRegistration] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalWeeks: 0,
    submittedWeeks: 0,
    approvedWeeks: 0,
    attendance: 0,
  });

  useEffect(() => {
    if (userRole && userRole !== "student") {
      navigate("/");
    }
  }, [userRole, navigate]);

  useEffect(() => {
    if (user) {
      checkRegistration();
      fetchStats();
    }
  }, [user]);

  const checkRegistration = async () => {
    try {
      const { data, error } = await supabase
        .from("students")
        .select("id")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setHasRegistration(!!data);
    } catch (error: any) {
      toast.error("Error checking registration");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Get student record
      const { data: studentData } = await supabase
        .from("students")
        .select("id")
        .eq("user_id", user?.id)
        .single();

      if (studentData) {
        // Get weeks stats
        const { data: weeksData } = await supabase
          .from("weeks")
          .select("status")
          .eq("student_id", studentData.id);

        const totalWeeks = weeksData?.length || 0;
        const submittedWeeks = weeksData?.filter(w => w.status === "submitted" || w.status === "approved").length || 0;
        const approvedWeeks = weeksData?.filter(w => w.status === "approved").length || 0;

        // Get attendance stats
        const { data: attendanceData } = await supabase
          .from("attendance")
          .select("id")
          .eq("student_id", studentData.id);

        setStats({
          totalWeeks,
          submittedWeeks,
          approvedWeeks,
          attendance: attendanceData?.length || 0,
        });
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
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
            <h1 className="text-3xl font-bold text-primary mb-2">Student Dashboard</h1>
            <p className="text-muted-foreground">Manage your SIWES logbook and training records</p>
          </div>

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
                <Button onClick={() => navigate("/student/pre-siwes")} size="lg">
                  Start Registration
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid md:grid-cols-4 gap-4">
                <Card className="shadow-card">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <BookOpen className="h-8 w-8 text-primary" />
                      <span className="text-3xl font-bold">{stats.totalWeeks}</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">Total Weeks</p>
                  </CardContent>
                </Card>

                <Card className="shadow-card">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <FileText className="h-8 w-8 text-primary" />
                      <span className="text-3xl font-bold">{stats.submittedWeeks}</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">Submitted</p>
                  </CardContent>
                </Card>

                <Card className="shadow-card">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CheckCircle className="h-8 w-8 text-primary" />
                      <span className="text-3xl font-bold">{stats.approvedWeeks}</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">Approved</p>
                  </CardContent>
                </Card>

                <Card className="shadow-card">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Calendar className="h-8 w-8 text-primary" />
                      <span className="text-3xl font-bold">{stats.attendance}</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">Days Present</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <Card className="shadow-card hover:shadow-elevated transition-all cursor-pointer" onClick={() => navigate("/student/logbook")}>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <BookOpen className="h-6 w-6 text-primary" />
                      <span>Weekly Logbook</span>
                    </CardTitle>
                    <CardDescription>
                      Record your daily activities and submit weekly reports
                    </CardDescription>
                  </CardHeader>
                </Card>

                <Card className="shadow-card hover:shadow-elevated transition-all cursor-pointer" onClick={() => navigate("/student/attendance")}>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Calendar className="h-6 w-6 text-primary" />
                      <span>Attendance</span>
                    </CardTitle>
                    <CardDescription>
                      Check in/out and view your attendance history
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard;
