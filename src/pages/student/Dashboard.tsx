import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { FileText, BookOpen, Calendar, CheckCircle, XCircle, Clock, Building, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

const StudentDashboard = () => {
  const { user, userRole, profile } = useAuth();
  const navigate = useNavigate();
  const [hasRegistration, setHasRegistration] = useState(false);
  const [loading, setLoading] = useState(true);
  const [studentInfo, setStudentInfo] = useState<any>(null);
  const [stats, setStats] = useState({
    totalWeeks: 0,
    submitted: 0,
    approved: 0,
    rejected: 0,
    pending: 0,
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
        .select("*")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setHasRegistration(!!data);
      setStudentInfo(data);
    } catch (error: any) {
      toast.error("Error checking registration");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { data: studentData } = await supabase
        .from("students")
        .select("id")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (studentData) {
        const { data: weeksData } = await supabase
          .from("weeks")
          .select("status")
          .eq("student_id", studentData.id);

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
                Track your SIWES progress and manage your weekly logbook
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate("/student/profile/edit")}>
                Edit Profile
              </Button>
              <Button variant="outline" onClick={() => navigate("/student/pre-siwes/edit")}>
                Edit Registration
              </Button>
            </div>
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
                <Button onClick={() => navigate("/student/pre-siwes")}>
                  Go to Registration Form
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
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

              <div className="grid md:grid-cols-3 gap-4">
                <Button 
                  onClick={() => navigate("/student/logbook")} 
                  className="h-24 flex-col gap-2"
                  size="lg"
                >
                  <BookOpen className="h-6 w-6" />
                  <span>My Logbook</span>
                </Button>
                <Button 
                  onClick={() => navigate("/student/pre-siwes")} 
                  variant="outline"
                  className="h-24 flex-col gap-2"
                  size="lg"
                >
                  <FileText className="h-6 w-6" />
                  <span>View Registration</span>
                </Button>
                <Button 
                  variant="outline"
                  className="h-24 flex-col gap-2"
                  size="lg"
                  disabled
                >
                  <Calendar className="h-6 w-6" />
                  <span>Attendance (Coming Soon)</span>
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
