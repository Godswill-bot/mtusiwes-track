const fs = require('fs');

const content = `import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCog, CheckCircle, AlertCircle, Building2, GraduationCap } from "lucide-react";
import { PortalToggle } from "@/components/admin/PortalToggle";
import { ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

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

  const schoolSupervisors = supervisors.filter(s => s.supervisor_type === "school_supervisor").length;
  const industrySupervisors = supervisors.filter(s => s.supervisor_type === "industry_supervisor").length;
  
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

  // Faculty data
  const facultyCounts = students.reduce((acc, student) => {
    const fac = student.faculty || "Unknown";
    acc[fac] = (acc[fac] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const facultyColors = ["#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6"];
  const facultyPieData = Object.entries(facultyCounts).map(([name, value], idx) => ({
    name,
    value,
    color: facultyColors[idx % facultyColors.length]
  }));

  // Department data
  const departmentCounts = students.reduce((acc, student) => {
    const dept = student.department || "Unknown";
    acc[dept] = (acc[dept] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const departmentBarData = Object.entries(departmentCounts)
    .sort((a, b) => b[1] - a[1]) // Sort descending
    .slice(0, 10) // Top 10 departments
    .map(([name, value]) => ({
      name: name.length > 15 ? name.substring(0, 15) + '...' : name,
      fullName: name,
      Students: value
    }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-100 rounded-lg shadow-lg text-sm z-50">
          <p className="font-semibold text-gray-800">{payload[0].name || payload[0].payload?.fullName || "Category"}</p>
          <p className="text-primary font-medium mt-1">
            Count: {payload[0].value}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <PortalToggle />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="shadow-sm bg-gradient-to-br from-purple-50 to-white border-purple-100 hover:shadow-md transition-all">
          <CardHeader className="pb-2 p-5">
            <div className="flex items-center justify-between">
              <Users className="h-7 w-7 text-purple-600" />
              <span className="text-3xl font-bold text-purple-700">{students.length}</span>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <p className="text-sm font-semibold text-purple-800">Total Students</p>
            <p className="text-xs text-purple-600/80 mt-1">Registered in system</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm bg-gradient-to-br from-blue-50 to-white border-blue-100 hover:shadow-md transition-all">
          <CardHeader className="pb-2 p-5">
            <div className="flex items-center justify-between">
              <UserCog className="h-7 w-7 text-blue-600" />
              <span className="text-3xl font-bold text-blue-700">{supervisors.length}</span>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <p className="text-sm font-semibold text-blue-800">Total Supervisors</p>
            <p className="text-xs text-blue-600/80 mt-1">{schoolSupervisors} school, {industrySupervisors} industry</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm bg-gradient-to-br from-emerald-50 to-white border-emerald-100 hover:shadow-md transition-all">
          <CardHeader className="pb-2 p-5">
            <div className="flex items-center justify-between">
              <CheckCircle className="h-7 w-7 text-emerald-600" />
              <span className="text-3xl font-bold text-emerald-700">{assignedStudents}</span>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <p className="text-sm font-semibold text-emerald-800">Assigned</p>
            <p className="text-xs text-emerald-600/80 mt-1">Have school supervisor</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm bg-gradient-to-br from-rose-50 to-white border-rose-100 hover:shadow-md transition-all">
          <CardHeader className="pb-2 p-5">
            <div className="flex items-center justify-between">
              <AlertCircle className="h-7 w-7 text-rose-600" />
              <span className="text-3xl font-bold text-rose-700">{unassignedStudents}</span>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <p className="text-sm font-semibold text-rose-800">Unassigned</p>
            <p className="text-xs text-rose-600/80 mt-1">Need school supervisor</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="shadow-sm border-gray-100 flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-gray-800">
              <Users className="h-4 w-4 text-emerald-500" />
              Students Assignment
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center">
            {studentPieData.length > 0 ? (
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={studentPieData}
                      cx="50%"
                      cy="45%"
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {studentPieData.map((entry, index) => (
                        <Cell key={\`cell-\${index}\`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-sm text-gray-400">No data available</div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-gray-100 flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-gray-800">
              <UserCog className="h-4 w-4 text-blue-500" />
              Supervisors Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center">
            {supervisorPieData.length > 0 ? (
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={supervisorPieData}
                      cx="50%"
                      cy="45%"
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {supervisorPieData.map((entry, index) => (
                        <Cell key={\`cell-\${index}\`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-sm text-gray-400">No data available</div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-gray-100 flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-gray-800">
              <GraduationCap className="h-4 w-4 text-purple-500" />
              Students by Faculty
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center">
            {facultyPieData.length > 0 ? (
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={facultyPieData}
                      cx="50%"
                      cy="45%"
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {facultyPieData.map((entry, index) => (
                        <Cell key={\`cell-\${index}\`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-sm text-gray-400">No data available</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-gray-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2 text-gray-800">
            <Building2 className="h-4 w-4 text-orange-500" />
            Top Departments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {departmentBarData.length > 0 ? (
            <div className="h-[300px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentBarData} margin={{ top: 5, right: 30, left: 20, bottom: 45 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#6B7280' }}
                    dy={10}
                    angle={-25}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#6B7280' }}
                    allowDecimals={false}
                  />
                  <Tooltip 
                    content={<CustomTooltip />}
                    cursor={{ fill: '#F3F4F6' }}
                  />
                  <Bar dataKey="Students" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50}>
                    {departmentBarData.map((entry, index) => (
                      <Cell key={\`cell-\${index}\`} fill={facultyColors[index % facultyColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-sm text-gray-400">No data available</div>
          )}
        </CardContent>
      </Card>

    </div>
  );
};
`;

fs.writeFileSync('src/components/admin/DashboardOverview.tsx', content);
console.log('Dashboard UI Enhanced!');
