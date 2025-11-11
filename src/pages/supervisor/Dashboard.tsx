import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileCheck, Clock, CheckCircle } from "lucide-react";

const SupervisorDashboard = () => {
  const { userRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (userRole && !["industry_supervisor", "school_supervisor"].includes(userRole)) {
      navigate("/");
    }
  }, [userRole, navigate]);

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
                  <Clock className="h-8 w-8 text-primary" />
                  <span className="text-3xl font-bold">0</span>
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
                  <span className="text-3xl font-bold">0</span>
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
                  <span className="text-3xl font-bold">0</span>
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
              <div className="text-center py-12 text-muted-foreground">
                <FileCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No pending submissions at this time</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default SupervisorDashboard;
