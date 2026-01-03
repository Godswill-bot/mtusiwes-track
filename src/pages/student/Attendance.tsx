import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Calendar, Clock, CheckCircle, XCircle, Loader2, LogIn, LogOut, Lock, AlertCircle } from "lucide-react";
import { format, parseISO, differenceInHours, differenceInMinutes } from "date-fns";
import { usePortalStatus } from "@/hooks/usePortalStatus";
import PortalClosed from "./PortalClosed";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

interface AttendanceRecord {
  id: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  verified: boolean;
  created_at: string;
}

interface TodayStatus {
  date: string;
  hasCheckedIn: boolean;
  hasCheckedOut: boolean;
  attendance: AttendanceRecord | null;
  siwesLocked: boolean;
}

const StudentAttendance = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { portalOpen, loading: portalLoading } = usePortalStatus();
  const [studentId, setStudentId] = useState<string | null>(null);
  const [siwesLocked, setSiwesLocked] = useState(false);

  // Get student ID and lock status
  useEffect(() => {
    const fetchStudentData = async () => {
      if (!user?.id) return;
      
      const { data: student } = await supabase
        .from("students")
        .select("id, siwes_locked")
        .eq("user_id", user.id)
        .maybeSingle();
        
      if (student) {
        setStudentId(student.id);
        setSiwesLocked(student.siwes_locked === true);
      }
    };
    
    fetchStudentData();
  }, [user?.id]);

  // Get auth token for API calls
  const getAuthToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  }, []);

  // Fetch today's status
  const { data: todayStatus, isPending: loadingToday, refetch: refetchToday } = useQuery({
    queryKey: ["attendance-today", user?.id],
    queryFn: async (): Promise<TodayStatus> => {
      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated");
      
      const response = await fetch(`${API_BASE_URL}/api/attendance/today`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch status");
      }
      
      return response.json();
    },
    enabled: !!user?.id,
    refetchInterval: 60000, // Refresh every minute
  });

  // Check-in mutation
  const checkInMutation = useMutation({
    mutationFn: async () => {
      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated");
      
      const response = await fetch(`${API_BASE_URL}/api/attendance/check-in`, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to check in");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast.success(`Checked in at ${data.time}`);
      refetchToday();
      queryClient.invalidateQueries({ queryKey: ["student-attendance"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  // Check-out mutation
  const checkOutMutation = useMutation({
    mutationFn: async () => {
      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated");
      
      const response = await fetch(`${API_BASE_URL}/api/attendance/check-out`, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to check out");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast.success(`Checked out at ${data.time}`);
      refetchToday();
      queryClient.invalidateQueries({ queryKey: ["student-attendance"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  // Fetch attendance records
  const { data: attendanceRecords = [], isPending: loadingAttendance } = useQuery({
    queryKey: ["student-attendance", studentId],
    queryFn: async () => {
      if (!studentId) return [];
      
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("student_id", studentId)
        .order("date", { ascending: false });
        
      if (error) throw error;
      return data as AttendanceRecord[];
    },
    enabled: !!studentId,
  });

  // Calculate statistics
  const totalDays = attendanceRecords.length;
  const verifiedDays = attendanceRecords.filter(r => r.verified).length;
  const daysWithCheckOut = attendanceRecords.filter(r => r.check_in_time && r.check_out_time).length;

  // Calculate total hours worked
  const calculateHoursWorked = (checkIn: string | null, checkOut: string | null): string => {
    if (!checkIn || !checkOut) return "N/A";
    
    // Parse times assuming same day
    const today = new Date();
    const checkInTime = new Date(`${format(today, 'yyyy-MM-dd')}T${checkIn}`);
    const checkOutTime = new Date(`${format(today, 'yyyy-MM-dd')}T${checkOut}`);
    
    const hours = differenceInHours(checkOutTime, checkInTime);
    const minutes = differenceInMinutes(checkOutTime, checkInTime) % 60;
    
    if (hours < 0) return "N/A";
    return `${hours}h ${minutes}m`;
  };

  const totalHoursWorked = attendanceRecords.reduce((total, record) => {
    if (!record.check_in_time || !record.check_out_time) return total;
    
    const today = new Date();
    const checkInTime = new Date(`${format(today, 'yyyy-MM-dd')}T${record.check_in_time}`);
    const checkOutTime = new Date(`${format(today, 'yyyy-MM-dd')}T${record.check_out_time}`);
    
    const hours = differenceInHours(checkOutTime, checkInTime);
    return total + (hours > 0 ? hours : 0);
  }, 0);

  if (portalLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (portalOpen === false) {
    return <PortalClosed />;
  }

  return (
    <div className="min-h-screen bg-gradient-light">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate("/student/dashboard")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>

          <div>
            <h1 className="text-3xl font-bold">My Attendance</h1>
            <p className="text-muted-foreground mt-1">
              {siwesLocked 
                ? "Your SIWES is completed. Attendance records are locked."
                : "Check in daily to record your attendance at work"
              }
            </p>
          </div>

          {/* Locked Warning */}
          {siwesLocked && (
            <Alert className="bg-amber-50 border-amber-200">
              <Lock className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800">Attendance Locked</AlertTitle>
              <AlertDescription className="text-amber-700">
                Your SIWES has been completed and graded. No more check-ins are allowed.
              </AlertDescription>
            </Alert>
          )}

          {/* Today's Check-in Card */}
          {!siwesLocked && (
            <Card className="shadow-card border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Today's Attendance - {format(new Date(), "EEEE, MMMM d, yyyy")}
                </CardTitle>
                <CardDescription>
                  {loadingToday 
                    ? "Loading status..."
                    : todayStatus?.hasCheckedIn
                      ? todayStatus?.hasCheckedOut
                        ? "You've completed your attendance for today! ✓"
                        : "You're checked in. Remember to check out before leaving."
                      : "Start your day by checking in below."
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  {/* Check-in Button */}
                  <Button
                    size="lg"
                    className="w-full sm:w-auto min-w-[200px]"
                    onClick={() => checkInMutation.mutate()}
                    disabled={
                      checkInMutation.isPending || 
                      loadingToday || 
                      todayStatus?.hasCheckedIn ||
                      siwesLocked
                    }
                    variant={todayStatus?.hasCheckedIn ? "secondary" : "default"}
                  >
                    {checkInMutation.isPending ? (
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    ) : todayStatus?.hasCheckedIn ? (
                      <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
                    ) : (
                      <LogIn className="h-5 w-5 mr-2" />
                    )}
                    {todayStatus?.hasCheckedIn 
                      ? `Checked in at ${todayStatus.attendance?.check_in_time || 'N/A'}`
                      : "Check In"
                    }
                  </Button>

                  {/* Check-out Button */}
                  <Button
                    size="lg"
                    className="w-full sm:w-auto min-w-[200px]"
                    onClick={() => checkOutMutation.mutate()}
                    disabled={
                      checkOutMutation.isPending || 
                      loadingToday || 
                      !todayStatus?.hasCheckedIn ||
                      todayStatus?.hasCheckedOut ||
                      siwesLocked
                    }
                    variant={todayStatus?.hasCheckedOut ? "secondary" : "outline"}
                  >
                    {checkOutMutation.isPending ? (
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    ) : todayStatus?.hasCheckedOut ? (
                      <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
                    ) : (
                      <LogOut className="h-5 w-5 mr-2" />
                    )}
                    {todayStatus?.hasCheckedOut 
                      ? `Checked out at ${todayStatus.attendance?.check_out_time || 'N/A'}`
                      : "Check Out"
                    }
                  </Button>
                </div>

                {/* Today's Summary */}
                {todayStatus?.hasCheckedIn && todayStatus?.hasCheckedOut && todayStatus.attendance && (
                  <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-green-800 font-medium flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Hours worked today: {calculateHoursWorked(
                        todayStatus.attendance.check_in_time,
                        todayStatus.attendance.check_out_time
                      )}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Days</CardDescription>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  {totalDays}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Verified Days</CardDescription>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  {verifiedDays}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Complete Days</CardDescription>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-500" />
                  {daysWithCheckOut}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Hours</CardDescription>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Clock className="h-5 w-5 text-purple-500" />
                  {totalHoursWorked}h
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Attendance Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Attendance History
              </CardTitle>
              <CardDescription>
                Your complete check-in and check-out records
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingAttendance ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : attendanceRecords.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No attendance records found</p>
                  <p className="text-sm mt-1">
                    {siwesLocked 
                      ? "No attendance was recorded during your SIWES period."
                      : "Start by clicking the Check In button above to record your first attendance."
                    }
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Check-in</TableHead>
                        <TableHead>Check-out</TableHead>
                        <TableHead>Hours Worked</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendanceRecords.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">
                            {format(parseISO(record.date), "EEEE, MMM d, yyyy")}
                          </TableCell>
                          <TableCell>
                            {record.check_in_time ? (
                              <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4 text-green-500" />
                                {record.check_in_time}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {record.check_out_time ? (
                              <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4 text-red-500" />
                                {record.check_out_time}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {calculateHoursWorked(record.check_in_time, record.check_out_time)}
                          </TableCell>
                          <TableCell>
                            {record.verified ? (
                              <Badge variant="default" className="bg-green-500">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Verified
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                <XCircle className="h-3 w-3 mr-1" />
                                Pending
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default StudentAttendance;
