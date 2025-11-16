import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, Mail, Phone, Building } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Student {
  id: string;
  matric_no: string;
  department: string;
  faculty: string;
  organisation_name: string;
  organisation_address: string;
  industry_supervisor_name: string;
  school_supervisor_name: string | null;
  user_id: string;
  email: string;
  phone: string;
  profile: {
    full_name: string;
  };
}

const StudentsList = () => {
  const { userRole, user } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userRole && !["industry_supervisor", "school_supervisor"].includes(userRole)) {
      navigate("/");
    }
  }, [userRole, navigate]);

  useEffect(() => {
    if (user && userRole) {
      fetchAssignedStudents();
    }
  }, [user, userRole]);

  const fetchAssignedStudents = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Get supervisor's name from profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      const supervisorName = profileData?.full_name;

      if (!supervisorName) {
        setStudents([]);
        setLoading(false);
        return;
      }

      // Fetch students based on supervisor type - match by name
      const nameField = userRole === "industry_supervisor" 
        ? "industry_supervisor_name" 
        : "school_supervisor_name";

      const { data: studentsData, error: studentsError } = await supabase
        .from("students")
        .select(`
          id,
          matric_no,
          department,
          faculty,
          organisation_name,
          organisation_address,
          industry_supervisor_name,
          school_supervisor_name,
          user_id,
          email,
          phone
        `)
        .eq(nameField, supervisorName);

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

      // Combine data
      const studentsWithProfiles = studentsData.map(student => {
        const profile = profilesData?.find(p => p.id === student.user_id);
        return {
          ...student,
          profile: profile || { full_name: 'Unknown' }
        };
      });

      setStudents(studentsWithProfiles);
    } catch (error: any) {
      toast.error("Error loading students");
      console.error(error);
    } finally {
      setLoading(false);
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
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/supervisor/dashboard")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-primary">Assigned Students</h1>
              <p className="text-muted-foreground mt-1">
                Students under your supervision
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{students.length}</span>
            </div>
          </div>

          {students.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No students assigned to you yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {students.map((student) => (
                <Card key={student.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-xl">{student.profile.full_name}</CardTitle>
                    <CardDescription>
                      {student.matric_no} • {student.department}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-2 text-sm">
                      <Building className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="font-medium">{student.organisation_name}</p>
                        <p className="text-muted-foreground text-xs">{student.organisation_address}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a href={`mailto:${student.email}`} className="text-primary hover:underline">
                        {student.email}
                      </a>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${student.phone}`} className="text-primary hover:underline">
                        {student.phone}
                      </a>
                    </div>

                    {userRole === "school_supervisor" && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground">Industry Supervisor</p>
                        <p className="text-sm font-medium">{student.industry_supervisor_name}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default StudentsList;
