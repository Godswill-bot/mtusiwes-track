import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCog } from "lucide-react";
import { PortalToggle } from "@/components/admin/PortalToggle";
import { ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip } from "recharts";

// Fetch students - try backend API first, fallback to direct Supabase
const fetchStudents = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
};

// Fetch supervisors - try backend API first, fallback to direct Supabase
const fetchSupervisors = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  
  const { data, error } = await supabase
    .from("supervisors")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
};

// Chart colors

export const DashboardOverview = () => {
  const studentsQuery = useQuery({
    queryKey: ["admin", "students"],
    queryFn: fetchStudents,
  });

  const supervisorsQuery = useQuery({
    queryKey: ["admin", "supervisors"],
    queryFn: fetchSupervisors,
  });

  const students = studentsQuery.data || [];
  const supervisors = supervisorsQuery.data || [];

  // Calculate stats
  const totalStudents = students.length;
  const schoolSupervisors = supervisors.filter((s: { supervisor_type: string }) => s.supervisor_type === "school_supervisor").length;
  
  // Count industry supervisors: real ones from table + unique virtual ones from students
  const realIndustrySupervisors = supervisors.filter((s: { supervisor_type: string }) => s.supervisor_type === "industry_supervisor");
  const realIndustryEmails = new Set(realIndustrySupervisors.map((s: { email: string }) => s.email?.toLowerCase()));
  
  // Count unique industry supervisors from students that aren't in the supervisors table
  const virtualIndustrySupervisorNames = new Set<string>();
  students.forEach((student: { industry_supervisor_name?: string; industry_supervisor_email?: string }) => {
    if (student.industry_supervisor_name && 
        (!student.industry_supervisor_email || !realIndustryEmails.has(student.industry_supervisor_email.toLowerCase()))) {
      virtualIndustrySupervisorNames.add(student.industry_supervisor_name.toLowerCase().trim());
    }
  });
  
  const industrySupervisors = realIndustrySupervisors.length + virtualIndustrySupervisorNames.size;
  const totalSupervisors = schoolSupervisors + industrySupervisors;
  
  // Supervisor distribution pie data
  const supervisorPieData = [
    { name: "School Supervisors", value: schoolSupervisors, color: '#8b5cf6' },
    { name: "Industry Supervisors", value: industrySupervisors, color: '#22c55e' },
  ].filter(item => item.value > 0);

  const isLoading = studentsQuery.isLoading || supervisorsQuery.isLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Portal Toggle */}
      <PortalToggle />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="shadow-card bg-gradient-to-br from-purple-50 to-white border-purple-200">
          <CardHeader className="pb-2 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
              <Users className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600" />
              <span className="text-2xl sm:text-3xl font-bold text-purple-700">{totalStudents}</span>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            <p className="text-xs sm:text-sm font-medium text-purple-600">Total Students</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Registered in system</p>
          </CardContent>
        </Card>

        <Card className="shadow-card bg-gradient-to-br from-green-50 to-white border-green-200">
          <CardHeader className="pb-2 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
              <UserCog className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
              <span className="text-2xl sm:text-3xl font-bold text-green-700">{totalSupervisors}</span>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            <p className="text-xs sm:text-sm font-medium text-green-600">Total Supervisors</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">{schoolSupervisors} school, {industrySupervisors} industry</p>
          </CardContent>
        </Card>

      </div>

      {/* Supervisor Distribution */}
      {supervisorPieData.length > 0 && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5 text-primary" />
              Supervisor Distribution
            </CardTitle>
            <CardDescription>Breakdown of supervisor types</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={supervisorPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={true}
                  >
                    {supervisorPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
