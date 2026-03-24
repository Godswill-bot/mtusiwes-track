import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, UserCog, CheckCircle, AlertCircle, TrendingUp, Presentation, ArrowUpRight, Activity, CalendarDays } from "lucide-react";
import { PortalToggle } from "@/components/admin/PortalToggle";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Legend, PieChart, Pie, Cell } from "recharts";

import { format, subMonths, eachMonthOfInterval, startOfMonth, subDays, eachDayOfInterval, startOfDay } from "date-fns";

const fetchDashboardStats = async () => {
  const [studentsRes, supervisorsRes, logsRes] = await Promise.all([
    supabase.from("students").select("id, supervisor_id, created_at, is_active"),
    supabase.from("supervisors").select("id, supervisor_type, created_at"),
    supabase.from("audit_logs").select("id, action_type, created_at, table_name").order("created_at", { ascending: false }).limit(200)
  ]);

  const students = studentsRes.data || [];
  const supervisors = supervisorsRes.data || [];
  const logs = logsRes.data || [];

  return { students, supervisors, recentActivity: logs };
};

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f43f5e'];

interface AdminDashboardOverviewProps {
  onViewAllActivity?: () => void;
}

export const AdminDashboardOverview = ({ onViewAllActivity }: AdminDashboardOverviewProps) => {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard-stats-v2"],
    queryFn: fetchDashboardStats,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-40 bg-muted rounded-xl" />
        ))}
        <div className="col-span-1 lg:col-span-3 h-96 bg-muted rounded-xl" />
        <div className="col-span-1 h-96 bg-muted rounded-xl" />
      </div>
    );
  }

  const students = data?.students || [];
  const supervisors = data?.supervisors || [];
  const recentActivity = data?.recentActivity || [];

  const unassignedStudents = students.filter(s => !s.supervisor_id).length;
  const assignedStudents = students.length - unassignedStudents;
  const schoolSupervisors = supervisors.filter(s => s.supervisor_type === 'school_supervisor').length;
  
  const studentDistribution = [
    { name: 'Assigned', value: assignedStudents },
    { name: 'Unassigned', value: unassignedStudents },
  ];

  // Dynamic Growth Data (last 6 months)
  const growthData = Array.from({ length: 6 }).map((_, i) => {
    const d = subMonths(new Date(), 5 - i);
    const monthStart = startOfMonth(d);
    // cumulative before the end of that month... or just during that month? 
    // Usually growth represents cumulative total up to that month
    const curStudents = students.filter(s => new Date(s.created_at) < new Date(d.getFullYear(), d.getMonth() + 1, 1)).length;
    const curSupervisors = supervisors.filter(s => new Date(s.created_at) < new Date(d.getFullYear(), d.getMonth() + 1, 1)).length;
    return {
      name: format(d, 'MMM'),
      students: curStudents,
      supervisors: curSupervisors
    };
  });

  // Dynamic Engagement Data (last 7 days from audit logs)
  const engagementData = Array.from({ length: 7 }).map((_, i) => {
    const d = subDays(new Date(), 6 - i);
    const dayStart = startOfDay(d).getTime();
    const dayEnd = dayStart + 86400000;
    
    // Using audit logs as proxy for engagement. "visits" (all logs), "submissions" (specific tables)
    const dayLogs = recentActivity.filter(l => {
      const time = new Date(l.created_at).getTime();
      return time >= dayStart && time < dayEnd;
    });

    const submissions = dayLogs.filter(l => l.table_name === 'weekly_reports' || l.action_type === 'submit_report').length;
    
    return {
      day: format(d, 'EEE'),
      visits: dayLogs.length, // total actions on that day as a proxy for "Portal Visits/Actions"
      submissions: submissions
    };
  });

  // Most recent 5 activities
  const displayActivities = recentActivity.slice(0, 5).map(log => {
    let type: "success" | "info" | "warning" | "default" = "default";
    let label = `${log.action_type} on ${log.table_name}`;
    
    if (log.action_type.includes('CREATE')) type = 'success';
    else if (log.action_type.includes('UPDATE')) type = 'info';
    else if (log.action_type.includes('DELETE')) type = 'warning';

    // Make labels more user-friendly
    if (log.table_name === 'students' && log.action_type === 'CREATE') label = 'New Student Registered';
    if (log.table_name === 'supervisors' && log.action_type === 'CREATE') label = 'New Supervisor Added';
    if (log.table_name === 'weekly_reports') label = 'Logbook Entry Update';

    return {
      label,
      time: format(new Date(log.created_at), 'hh:mm a, MMM d'),
      type,
      user: 'System' // since we didn't fetch user details in this quick query
    };
  });

  // Calculate active students using precisely the student's is_active status in the db
  const usersActiveToday = students.filter(s => s.is_active).length;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card/50 p-4 rounded-2xl backdrop-blur-sm border border-purple-100/50 dark:border-purple-900/50">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-700 to-indigo-600 dark:from-purple-400 dark:to-indigo-400 bg-clip-text text-transparent">System Overview</h2>
          <p className="text-muted-foreground text-sm">Real-time statistics and analytics for the SIWES platform.</p>
        </div>
        <PortalToggle />
      </div>

      {/* Top KPI Cards - Highly Detailed */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-none shadow-sm bg-gradient-to-br from-purple-50 via-white to-purple-50/50 dark:from-purple-950/20 dark:via-background dark:to-purple-900/10 hover:shadow-md transition-all overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Users className="w-16 h-16" />
          </div>
          <CardHeader className="pb-2">
            <CardDescription className="font-medium text-purple-600 dark:text-purple-400">Total Students</CardDescription>
            <CardTitle className="text-4xl text-foreground">{students.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm mt-2">
              <span className={`flex items-center ${usersActiveToday > 0 ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10' : 'text-muted-foreground bg-muted'} px-2 py-0.5 rounded-full font-medium`}>
                <Activity className="w-3 h-3 mr-1" /> {usersActiveToday > 0 ? usersActiveToday : 0}
              </span>
              <span className="text-muted-foreground">Actively Online in System</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-gradient-to-br from-blue-50 via-white to-blue-50/50 dark:from-blue-950/20 dark:via-background dark:to-blue-900/10 hover:shadow-md transition-all overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <UserCog className="w-16 h-16" />
          </div>
          <CardHeader className="pb-2">
            <CardDescription className="font-medium text-blue-600 dark:text-blue-400">Total Supervisors</CardDescription>
            <CardTitle className="text-4xl text-foreground">{supervisors.length}</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="flex items-center gap-2 text-sm mt-2">
              <span className="flex items-center text-blue-600 dark:text-blue-400 bg-primary/10 dark:bg-primary/20 px-2 py-0.5 rounded-full font-medium">
                {schoolSupervisors} School
              </span>
              <span className="text-muted-foreground">Supervisors onboarded</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-gradient-to-br from-emerald-50 via-white to-emerald-50/50 dark:from-emerald-950/20 dark:via-background dark:to-emerald-900/10 hover:shadow-md transition-all overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <CheckCircle className="w-16 h-16" />
          </div>
          <CardHeader className="pb-2">
            <CardDescription className="font-medium text-emerald-600 dark:text-emerald-400">Assigned</CardDescription>
            <CardTitle className="text-4xl text-foreground">{assignedStudents}</CardTitle>
          </CardHeader>
          <CardContent>
             <progress 
               className="w-full appearance-none h-2 mt-4 rounded-full bg-muted [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-value]:bg-emerald-500 [&::-webkit-progress-value]:rounded-full [&::-moz-progress-bar]:bg-emerald-500 [&::-moz-progress-bar]:rounded-full" 
               value={assignedStudents} 
               max={Math.max(students.length, 1)} 
             />
             <p className="text-xs text-muted-foreground mt-2">Placement completion rate</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-gradient-to-br from-rose-50 via-white to-rose-50/50 dark:from-rose-950/20 dark:via-background dark:to-rose-900/10 hover:shadow-md transition-all overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <AlertCircle className="w-16 h-16" />
          </div>
          <CardHeader className="pb-2">
            <CardDescription className="font-medium text-rose-600 dark:text-rose-400">Pending Assignment</CardDescription>
            <CardTitle className="text-4xl text-foreground">{unassignedStudents}</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="flex items-center gap-2 text-sm mt-2">
              <span className="flex items-center text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full font-medium">
                Action Required
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Analytics Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Main Growth Area Chart */}
        <Card className="lg:col-span-8 border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-8">
            <div>
              <CardTitle className="text-lg text-foreground">Registration Growth Matrix</CardTitle>
              <CardDescription>Multi-metric tracking of platform adoption over current academic year</CardDescription>
            </div>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growthData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorStudents" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorSupervisors" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} dx={-10} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Area type="monotone" dataKey="students" name="Students" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorStudents)" />
                  <Area type="monotone" dataKey="supervisors" name="Supervisors" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorSupervisors)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Assignment Ratio Pie Chart */}
        <Card className="lg:col-span-4 border-none shadow-sm flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Placement Distribution</CardTitle>
            <CardDescription>Current status of student IT assignments</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col items-center justify-center">
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={studentDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {studentDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => [`${value} Students`, '']}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="bottom" iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full mt-4 bg-muted p-4 rounded-xl text-center">
              <p className="text-sm text-muted-foreground">Total Unassigned requires attention</p>
              <p className="text-xl font-bold text-rose-600 mt-1">{unassignedStudents} <span className="text-sm font-normal text-muted-foreground">Students</span></p>
            </div>
          </CardContent>
        </Card>

        {/* Weekly Engagement Bar Chart */}
        <Card className="lg:col-span-7 border-none shadow-sm bg-gradient-to-br from-indigo-900 to-purple-900 dark:from-indigo-950 dark:to-purple-950 dark:border-purple-900/30 border-transparent text-white relative overflow-hidden">
          <div className="absolute -right-20 -top-20 opacity-10 blur-2xl rounded-full w-64 h-64 bg-card" />
          <CardHeader>
            <CardTitle className="text-lg text-white">Weekly Platform Engagement</CardTitle>
            <CardDescription className="text-indigo-200">Logbook submissions and portal visits per day</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={engagementData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff20" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#c7d2fe', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#c7d2fe', fontSize: 12}} />
                  <Tooltip 
                    cursor={{fill: '#ffffff10'}}
                    contentStyle={{ backgroundColor: '#1e1b4b', borderRadius: '12px', border: '1px solid #3730a3', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ color: '#fff' }} />
                  <Bar dataKey="visits" name="Portal Visits" fill="#818cf8" radius={[4, 4, 0, 0]} barSize={12} />
                  <Bar dataKey="submissions" name="Logbook Entries" fill="#34d399" radius={[4, 4, 0, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity List */}
        <Card className="lg:col-span-5 border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg text-foreground">System Activity Pulse</CardTitle>
              <CardDescription>Most recent occurrences across the platform</CardDescription>
            </div>
            <Activity className="w-5 h-5 text-muted-foreground/70" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4 mt-4">
              {displayActivities.length > 0 ? displayActivities.map((activity, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted transition border border-transparent hover:border-border">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    activity.type === 'success' ? 'bg-emerald-500' :
                    activity.type === 'info' ? 'bg-primary/100' :
                    activity.type === 'warning' ? 'bg-amber-500' : 'bg-purple-500'
                  }`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{activity.label}</p>
                    <p className="text-xs text-muted-foreground">by {activity.user}</p>
                  </div>
                  <span className="text-xs text-muted-foreground/70 whitespace-nowrap flex items-center bg-muted px-2 py-1 rounded-md">
                    <CalendarDays className="w-3 h-3 mr-1" />
                    {activity.time}
                  </span>
                </div>
              )) : (
                <div className="text-center py-6 text-sm text-muted-foreground">No recent activity detected.</div>
              )}
            </div>
            <button 
              onClick={onViewAllActivity}
              className="w-full mt-6 py-2 text-sm text-purple-600 font-medium hover:bg-purple-50 rounded-lg transition"
            >
              View All Activity →
            </button>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};