const fs = require('fs');

const code = `import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCog, CheckCircle, AlertCircle } from "lucide-react";
import { PortalToggle } from "@/components/admin/PortalToggle";
import { ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip } from "recharts";

const fetchStudents = async () => {
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
};

const fetchSupervisors = async () => {
  const { data, error } = await supabase
    .from("supervisors")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
};

export const DashboardOverview = () => {
  const { data: students = [], isLoading: loadingStudents } = useQuery({
    queryKey: ["admin-students"],
    queryFn: fetchStudents,
  });

  const { data: supervisors = [], isLoading: loadingSupervisors } = useQuery({
    queryKey: ["admin-supervisors"],
    queryFn: fetchSupervisors,
  });

  if (loadingStudents || loadingSupervisors) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  const schoolSupervisors = supervisors.filter(s => s.role === "school_supervisor").length;
  const industrySupervisors = supervisors.filter(s => s.role === "industry_supervisor").length;
  
  const assignedStudents = students.filter(s => s.school_supervisor_id !== null).length;
  const unassignedStudents = students.filter(s => s.school_supervisor_id === null).length;

  const supervisorPieData = [
    { name: "School", value: schoolSupervisors, color: "#9b87f5" },
    { name: "Industry", value: industrySupervisors, color: "#7E69AB" }
  ].filter(d => d.value > 0);

  const studentPieData = [
    { name: "Assigned", value: assignedStudents, color: "#10b981" },
    { name: "Unassigned", value: unassignedStudents, color: "#ef4444" }
  ].filter(d => d.value > 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-2 border border-gray-200 rounded shadow-sm text-sm">
          <p className="font-semibold">{payload[0].name}</p>
          <p className="text-gray-600">Count: {payload[0].value}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <PortalToggle />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-card bg-gradient-to-br from-purple-50 to-white border-purple-200">
          <CardHeader className="pb-2 p-4">
            <div className="flex items-center justify-between">
              <Users className="h-6 w-6 text-purple-600" />
              <span className="text-2xl font-bold text-purple-700">{students.length}</span>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-sm font-medium text-purple-600">Total Students</p>
            <p className="text-xs text-muted-foreground">Registered in system</p>
          </CardContent>
        </Card>

        <Card className="shadow-card bg-gradient-to-br from-blue-50 to-white border-blue-200">
          <CardHeader className="pb-2 p-4">
            <div className="flex items-center justify-between">
              <UserCog className="h-6 w-6 text-blue-600" />
              <span className="text-2xl font-bold text-blue-700">{supervisors.length}</span>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-sm font-medium text-blue-600">Total Supervisors</p>
            <p className="text-xs text-muted-foreground">{schoolSupervisors} school, {industrySupervisors} industry</p>
          </CardContent>
        </Card>

        <Card className="shadow-card bg-gradient-to-br from-emerald-50 to-white border-emerald-200">
          <CardHeader className="pb-2 p-4">
            <div className="flex items-center justify-between">
              <CheckCircle className="h-6 w-6 text-emerald-600" />
              <span className="text-2xl font-bold text-emerald-700">{assignedStudents}</span>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-sm font-medium text-emerald-600">Assigned</p>
            <p className="text-xs text-muted-foreground">Have school supervisor</p>
          </CardContent>
        </Card>

        <Card className="shadow-card bg-gradient-to-br from-rose-50 to-white border-rose-200">
          <CardHeader className="pb-2 p-4">
            <div className="flex items-center justify-between">
              <AlertCircle className="h-6 w-6 text-rose-600" />
              <span className="text-2xl font-bold text-rose-700">{unassignedStudents}</span>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-sm font-medium text-rose-600">Unassigned</p>
            <p className="text-xs text-muted-foreground">Need school supervisor</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {supervisorPieData.length > 0 && (
          <Card className="shadow-card">
            <CardHeader className="pb-0">
              <CardTitle className="text-lg flex items-center gap-2">
                <UserCog className="h-5 w-5 text-primary" />
                Supervisors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={supervisorPieData}
                      cx="50%"
                      cy="45%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {supervisorPieData.map((entry, index) => (
                        <Cell key={\`cell-\${index}\`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {studentPieData.length > 0 && (
          <Card className="shadow-card">
            <CardHeader className="pb-0">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Students Assignment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={studentPieData}
                      cx="50%"
                      cy="45%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {studentPieData.map((entry, index) => (
                        <Cell key={\`cell-\${index}\`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
`;

fs.writeFileSync('src/components/admin/DashboardOverview.tsx', code);
console.log("Dashboard rewritten")
