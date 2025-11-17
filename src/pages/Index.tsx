import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, FileText, Users, CheckCircle } from "lucide-react";

const Index = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();

  // Don't redirect - show login options instead

  useEffect(() => {
    if (user && userRole) {
      // Redirect based on role
      switch (userRole) {
        case "student":
          navigate("/student/dashboard");
          break;
        case "industry_supervisor":
          navigate("/supervisor/dashboard");
          break;
        case "school_supervisor":
          navigate("/supervisor/dashboard");
          break;
        case "admin":
          navigate("/admin/dashboard");
          break;
      }
    }
  }, [user, userRole, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  // If not logged in, show login options
  if (!loading && !user) {
    return (
      <div className="min-h-screen bg-gradient-light flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl shadow-elevated">
          <CardHeader className="text-center space-y-4">
            <div>
              <CardTitle className="text-3xl font-bold">MTU SIWES Logbook</CardTitle>
              <CardDescription className="text-lg">Mountain Top University</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-center mb-6">Select Your Portal</h2>
              
              <div className="grid gap-4">
                <Button
                  onClick={() => navigate("/auth/student")}
                  size="lg"
                  className="h-20 text-lg"
                >
                  <Users className="h-6 w-6 mr-3" />
                  Student Login / Sign Up
                </Button>

                <Button
                  onClick={() => navigate("/auth/supervisor")}
                  variant="outline"
                  size="lg"
                  className="h-20 text-lg"
                >
                  <CheckCircle className="h-6 w-6 mr-3" />
                  Supervisor Login
                </Button>

                <Button
                  onClick={() => navigate("/auth/admin")}
                  variant="outline"
                  size="lg"
                  className="h-20 text-lg"
                >
                  <FileText className="h-6 w-6 mr-3" />
                  Admin Login
                </Button>
              </div>

              <p className="text-sm text-muted-foreground text-center mt-6">
                Supervisors: Your account will be created by the school supervisor
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-light">
      <Navbar />
      
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold text-primary">
              Welcome to MTU SIWES Logbook
            </h1>
            <p className="text-lg text-muted-foreground">
              Digital logbook management system for Student Industrial Work Experience Scheme
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mt-12">
            <Card className="shadow-card hover:shadow-elevated transition-all">
              <CardHeader>
                <BookOpen className="h-12 w-12 text-primary mb-2" />
                <CardTitle>Digital Logbook</CardTitle>
                <CardDescription>
                  Record your weekly activities and training progress
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="shadow-card hover:shadow-elevated transition-all">
              <CardHeader>
                <CheckCircle className="h-12 w-12 text-primary mb-2" />
                <CardTitle>Digital Verification</CardTitle>
                <CardDescription>
                  Secure digital stamps and supervisor approval system
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="shadow-card hover:shadow-elevated transition-all">
              <CardHeader>
                <FileText className="h-12 w-12 text-primary mb-2" />
                <CardTitle>Pre-SIWES Form</CardTitle>
                <CardDescription>
                  Complete your registration before starting training
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="shadow-card hover:shadow-elevated transition-all">
              <CardHeader>
                <Users className="h-12 w-12 text-primary mb-2" />
                <CardTitle>Attendance Tracking</CardTitle>
                <CardDescription>
                  Monitor daily check-ins and training presence
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
