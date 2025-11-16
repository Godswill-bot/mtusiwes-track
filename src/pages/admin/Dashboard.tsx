import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, BookOpen, Shield, Activity, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const AdminDashboard = () => {
  const { userRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (userRole && userRole !== "admin") {
      navigate("/");
    }
  }, [userRole, navigate]);

  return (
    <div className="min-h-screen bg-gradient-light">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-primary mb-2">Admin Dashboard</h1>
            <p className="text-muted-foreground">System overview and management</p>
          </div>

          <div className="grid md:grid-cols-4 gap-4">
            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Users className="h-8 w-8 text-primary" />
                  <span className="text-3xl font-bold">0</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Total Students</p>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Shield className="h-8 w-8 text-primary" />
                  <span className="text-3xl font-bold">0</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Supervisors</p>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <BookOpen className="h-8 w-8 text-primary" />
                  <span className="text-3xl font-bold">0</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Active Logbooks</p>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Activity className="h-8 w-8 text-primary" />
                  <span className="text-3xl font-bold">0</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Weekly Activity</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Recent Registrations</CardTitle>
                <CardDescription>Latest student sign-ups</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No recent registrations</p>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>System Activity</CardTitle>
                <CardDescription>Recent actions and updates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No recent activity</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
