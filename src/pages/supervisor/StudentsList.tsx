import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Download, Users, Mail, Phone, Building } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Student {
  id: string;
  full_name: string | null;
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
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userRole && !["industry_supervisor", "school_supervisor"].includes(userRole)) {
      navigate("/");
    }
  }, [userRole, navigate]);

  const fetchAssignedStudents = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      // First, get the supervisor record for the current user
      const { data: supervisorData, error: supervisorError } = await supabase
        .from("supervisors")
        .select("id, name, email, supervisor_type")
        .eq("user_id", user.id)
        .single();

      if (supervisorError) {
        console.error("Could not find supervisor record:", supervisorError);
        // Fallback to old method using profile name
        await fetchStudentsByProfileName();
        return;
      }

      console.log("Supervisor record:", supervisorData);

      // Use supervisor_assignments table to get assigned students (most reliable)
      const { data: assignments, error: assignError } = await supabase
        .from("supervisor_assignments")
        .select(`
          student_id,
          students (
            id,
            full_name,
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
          )
        `)
        .eq("supervisor_id", supervisorData.id)
        .eq("assignment_type", userRole === "industry_supervisor" ? "industry_supervisor" : "school_supervisor");

      if (assignError) {
        console.error("Error fetching assignments:", assignError);
        // Fallback to direct students table query
        await fetchStudentsByProfileName();
        return;
      }

      // Extract students from assignments
      const studentsData = assignments
        ?.map(a => a.students)
        .filter(Boolean) as typeof students;

      console.log("Students found via assignments:", studentsData?.length || 0);

      if (!studentsData || studentsData.length === 0) {
        // Try fallback method
        await fetchStudentsByProfileName();
        return;
      }

      // Fetch profiles for students
      const userIds = studentsData.map(s => s.user_id);
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      // Combine data — prefer full_name stored on students table, fall back to profiles
      const studentsWithProfiles = studentsData.map(student => {
        const profile = profilesData?.find(p => p.id === student.user_id);
        return {
          ...student,
          profile: { full_name: student.full_name || profile?.full_name || "Unknown" }
        };
      });

      setStudents(studentsWithProfiles);
    } catch (error: unknown) {
      toast.error("Error loading students");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [user, userRole]);

  // Fallback method: fetch students by matching supervisor name in students table
  const fetchStudentsByProfileName = async () => {
    try {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user?.id)
        .single();

      const supervisorName = profileData?.full_name;
      if (!supervisorName) {
        setStudents([]);
        return;
      }

      const nameField = userRole === "industry_supervisor" 
        ? "industry_supervisor_name" 
        : "school_supervisor_name";

      const { data: studentsData } = await supabase
        .from("students")
        .select(`
          id,
          full_name,
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
        .ilike(nameField, supervisorName);

      if (!studentsData || studentsData.length === 0) {
        setStudents([]);
        return;
      }

      const userIds = studentsData.map(s => s.user_id);
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      const studentsWithProfiles = studentsData.map(student => {
        const profile = profilesData?.find(p => p.id === student.user_id);
        return {
          ...student,
          profile: { full_name: student.full_name || profile?.full_name || "Unknown" }
        };
      });

      setStudents(studentsWithProfiles);
    } catch (error) {
      console.error("Fallback fetch error:", error);
      setStudents([]);
    }
  };

  useEffect(() => {
    if (user && userRole) {
      fetchAssignedStudents();
    }
  }, [user, userRole, fetchAssignedStudents]);

  const downloadAsCSV = () => {
    const headers = ["Name", "Matric No.", "Faculty", "Department", "Email", "Phone", "Organisation", "Organisation Address", "Industry Supervisor", "School Supervisor"];
    const rows = filteredStudents.map((s) => [
      s.full_name || s.profile.full_name || "",
      s.matric_no || "",
      s.faculty || "",
      s.department || "",
      s.email || "",
      s.phone || "",
      s.organisation_name || "",
      s.organisation_address || "",
      s.industry_supervisor_name || "",
      s.school_supervisor_name || "",
    ]);
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `my_students_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredStudents = useMemo(() => {
    if (!searchTerm.trim()) return students;
    const needle = searchTerm.toLowerCase();
    return students.filter((s) =>
      [
        s.full_name || s.profile.full_name || "",
        s.matric_no || "",
        s.department || "",
        s.faculty || "",
        s.email || "",
        s.organisation_name || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [students, searchTerm]);

  const downloadPreRegistrationForm = (student: Student) => {
    const doc = new jsPDF();

    doc.setFontSize(22);
    doc.setTextColor(0, 0, 128);
    doc.text("Mountain Top University", 105, 20, { align: "center" });

    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text("Pre-SIWES Registration Form", 105, 30, { align: "center" });

    doc.setFontSize(12);
    doc.text(`Exported: ${new Date().toLocaleDateString()}`, 14, 45);

    doc.setFontSize(14);
    doc.text("1. Student Information", 14, 55);

    autoTable(doc, {
      startY: 60,
      theme: "grid",
      headStyles: { fillColor: [0, 51, 102] },
      body: [
        ["Full Name", student.full_name || student.profile?.full_name || "N/A"],
        ["Matriculation Number", student.matric_no || "N/A"],
        ["Email", student.email || "N/A"],
        ["Phone", student.phone || "N/A"],
        ["Department", student.department || "N/A"],
        ["Faculty", student.faculty || "N/A"],
      ],
    });

    const currentYOrg = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(14);
    doc.text("2. Placement Organization Details", 14, currentYOrg);

    autoTable(doc, {
      startY: currentYOrg + 5,
      theme: "grid",
      headStyles: { fillColor: [0, 51, 102] },
      body: [
        ["Organization Name", student.organisation_name || "N/A"],
        ["Organization Address", student.organisation_address || "N/A"],
      ],
    });

    const currentYSup = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(14);
    doc.text("3. Supervisors", 14, currentYSup);

    autoTable(doc, {
      startY: currentYSup + 5,
      theme: "grid",
      headStyles: { fillColor: [0, 51, 102] },
      body: [
        ["Industry Supervisor", student.industry_supervisor_name || "N/A"],
        ["School Supervisor", student.school_supervisor_name || "N/A"],
      ],
    });

    doc.setFontSize(10);
    doc.text("Official MTU SIWES Unit Documentation", 105, 280, { align: "center" });

    const safeName = (student.matric_no || student.profile?.full_name || "student").replace(/\s+/g, "_");
    doc.save(`${safeName}_Pre_SIWES_Form.pdf`);
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

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-primary">Assigned Students</h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-1">
                Students under your supervision
              </p>
            </div>
            <div className="flex items-center gap-3 self-start sm:self-auto">
              {students.length > 0 && (
                <Button variant="outline" onClick={downloadAsCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  Download CSV
                </Button>
              )}
              <div className="flex items-center gap-2 bg-primary/5 px-4 py-2 rounded-lg">
                <Users className="h-5 w-5 text-primary" />
                <span className="text-xl sm:text-2xl font-bold">{filteredStudents.length}</span>
              </div>
            </div>
          </div>

          <Input
            placeholder="Search assigned students"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:max-w-md"
          />

          {filteredStudents.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">
                  {students.length === 0 ? "No students assigned to you yet." : "No students match your search."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredStudents.map((student) => (
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

                    <div className="pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadPreRegistrationForm(student)}
                        className="w-full"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download Registration Form
                      </Button>
                    </div>
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
