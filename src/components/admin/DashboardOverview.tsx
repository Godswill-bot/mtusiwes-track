import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCog, FileText, CheckCircle, Clock, XCircle, TrendingUp } from "lucide-react";
import { PortalToggle } from "@/components/admin/PortalToggle";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip } from "recharts";
import { apiRequest } from "@/utils/api";

// Fetch students - try backend API first, fallback to direct Supabase
const fetchStudents = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  // Try backend API first
  if (token) {
    try {
      const response = await apiRequest("/api/admin/students", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const result = await response.json();
        return result.data;
      }
    } catch {
      // Backend unavailable, fall through to Supabase fallback
    }
  }

  // Fallback: Direct Supabase query
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

  // Try backend API first
  if (token) {
    try {
      const response = await apiRequest("/api/admin/supervisors", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const result = await response.json();
        return result.data;
      }
    } catch {
      // Backend unavailable, fall through to Supabase fallback
    }
  }

  // Fallback: Direct Supabase query
  const { data, error } = await supabase
    .from("supervisors")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
};

// Fetch weekly reports
const fetchWeeklyReports = async () => {
  const { data, error } = await supabase
    .from("weeks")
    .select("id, week_number, status, submitted_at, student_id")
    .order("week_number", { ascending: true });

  if (error) throw error;
  return data || [];
};

// Chart colors
const COLORS = ['#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6'];
const STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8',
  submitted: '#3b82f6',
  approved: '#22c55e',
  rejected: '#ef4444',
};

export const DashboardOverview = () => {
  const studentsQuery = useQuery({
    queryKey: ["admin", "students"],
    queryFn: fetchStudents,
  });

  const supervisorsQuery = useQuery({
    queryKey: ["admin", "supervisors"],
    queryFn: fetchSupervisors,
  });

  const weeksQuery = useQuery({
    queryKey: ["admin", "weekly-reports"],
    queryFn: fetchWeeklyReports,
  });

  const students = studentsQuery.data || [];
  const supervisors = supervisorsQuery.data || [];
  const weeks = weeksQuery.data || [];

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
  
  const totalReports = weeks.length;
  const approvedReports = weeks.filter((w: { status: string }) => w.status === "approved").length;
  const pendingReports = weeks.filter((w: { status: string }) => w.status === "submitted").length;
  const rejectedReports = weeks.filter((w: { status: string }) => w.status === "rejected").length;
  const draftReports = weeks.filter((w: { status: string }) => w.status === "draft").length;

  // Prepare histogram data (weekly report submissions per week)
  const weeklyHistogramData = Array.from({ length: 12 }, (_, i) => {
    const weekNum = i + 1;
    const weekReports = weeks.filter((w: { week_number: number }) => w.week_number === weekNum);
    return {
      week: `Week ${weekNum}`,
      submitted: weekReports.filter((w: { status: string }) => w.status !== "draft").length,
      approved: weekReports.filter((w: { status: string }) => w.status === "approved").length,
      pending: weekReports.filter((w: { status: string }) => w.status === "submitted").length,
    };
  });

  // Prepare pie chart data (report status distribution)
  const statusPieData = [
    { name: "Approved", value: approvedReports, color: STATUS_COLORS.approved },
    { name: "Pending", value: pendingReports, color: STATUS_COLORS.submitted },
    { name: "Rejected", value: rejectedReports, color: STATUS_COLORS.rejected },
    { name: "Draft", value: draftReports, color: STATUS_COLORS.draft },
  ].filter(item => item.value > 0);

  // Supervisor distribution pie data
  const supervisorPieData = [
    { name: "School Supervisors", value: schoolSupervisors, color: '#8b5cf6' },
    { name: "Industry Supervisors", value: industrySupervisors, color: '#22c55e' },
  ].filter(item => item.value > 0);

  const chartConfig = {
    submitted: { label: "Submitted", color: "#3b82f6" },
    approved: { label: "Approved", color: "#22c55e" },
    pending: { label: "Pending", color: "#f59e0b" },
  };

  const isLoading = studentsQuery.isLoading || supervisorsQuery.isLoading || weeksQuery.isLoading;

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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-card bg-gradient-to-br from-purple-50 to-white border-purple-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Users className="h-8 w-8 text-purple-600" />
              <span className="text-3xl font-bold text-purple-700">{totalStudents}</span>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium text-purple-600">Total Students</p>
            <p className="text-xs text-muted-foreground">Registered in system</p>
          </CardContent>
        </Card>

        <Card className="shadow-card bg-gradient-to-br from-green-50 to-white border-green-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <UserCog className="h-8 w-8 text-green-600" />
              <span className="text-3xl font-bold text-green-700">{totalSupervisors}</span>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium text-green-600">Total Supervisors</p>
            <p className="text-xs text-muted-foreground">{schoolSupervisors} school, {industrySupervisors} industry</p>
          </CardContent>
        </Card>

        <Card className="shadow-card bg-gradient-to-br from-blue-50 to-white border-blue-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <FileText className="h-8 w-8 text-blue-600" />
              <span className="text-3xl font-bold text-blue-700">{totalReports}</span>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium text-blue-600">Weekly Reports</p>
            <p className="text-xs text-muted-foreground">{approvedReports} approved</p>
          </CardContent>
        </Card>

        <Card className="shadow-card bg-gradient-to-br from-amber-50 to-white border-amber-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Clock className="h-8 w-8 text-amber-600" />
              <span className="text-3xl font-bold text-amber-700">{pendingReports}</span>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium text-amber-600">Pending Reviews</p>
            <p className="text-xs text-muted-foreground">Awaiting approval</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Report Histogram */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Weekly Report Submissions
            </CardTitle>
            <CardDescription>Number of reports submitted per week</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyHistogramData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="week" 
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="submitted" fill="#3b82f6" name="Submitted" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="approved" fill="#22c55e" name="Approved" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Report Status Pie Chart */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              Report Status Distribution
            </CardTitle>
            <CardDescription>Breakdown of weekly report statuses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {statusPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {statusPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No report data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Approved Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">{approvedReports}</span>
              <span className="text-sm text-muted-foreground">
                ({totalReports > 0 ? ((approvedReports / totalReports) * 100).toFixed(1) : 0}%)
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Reviews</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              <span className="text-2xl font-bold">{pendingReports}</span>
              <span className="text-sm text-muted-foreground">
                ({totalReports > 0 ? ((pendingReports / totalReports) * 100).toFixed(1) : 0}%)
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Rejected Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <span className="text-2xl font-bold">{rejectedReports}</span>
              <span className="text-sm text-muted-foreground">
                ({totalReports > 0 ? ((rejectedReports / totalReports) * 100).toFixed(1) : 0}%)
              </span>
            </div>
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
