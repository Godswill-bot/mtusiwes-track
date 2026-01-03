/**
 * Student Attendance Tabs View
 * Organizes attendance by student with tabs for each assigned student
 */

import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Users,
  FileDown,
  Maximize2,
  User,
  AlertCircle,
  TrendingUp,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { FullScreenAttendanceModal } from "./FullScreenAttendanceModal";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

interface AttendanceRecord {
  id: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  verified: boolean;
  created_at: string;
}

interface StudentAttendanceSummary {
  studentId: string;
  fullName: string;
  matricNo: string;
  department: string;
  totalDays: number;
  daysWithCheckOut: number;
  todayStatus: {
    checkedIn: boolean;
    checkedOut: boolean;
    checkInTime: string | null;
    checkOutTime: string | null;
  } | null;
}

interface StudentAttendanceDetail {
  student: {
    id: string;
    fullName: string;
    matricNo: string;
    department: string;
    level: string;
    organisation: string;
  };
  attendance: AttendanceRecord[];
  stats: {
    totalDays: number;
    daysWithCheckOut: number;
    verifiedDays: number;
    totalHours: number;
  };
}

interface SupervisorAttendanceSummary {
  students: StudentAttendanceSummary[];
  date: string;
}

export const StudentAttendanceTabsView = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("");
  const [fullScreenStudent, setFullScreenStudent] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);

  // Get auth token
  const getAuthToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  }, []);

  // Fetch attendance summary for all assigned students
  const {
    data: summary,
    isPending: summaryPending,
    error: summaryError,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ["supervisor-attendance-summary", user?.id],
    queryFn: async (): Promise<SupervisorAttendanceSummary> => {
      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated");

      const response = await fetch(
        `${API_BASE_URL}/api/attendance/supervisor/summary`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch attendance");
      }

      return response.json();
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  // Set initial active tab when data loads
  useMemo(() => {
    if (summary?.students?.length && !activeTab) {
      setActiveTab(summary.students[0].studentId);
    }
  }, [summary, activeTab]);

  // Fetch detailed attendance for the active student
  const {
    data: studentDetail,
    isPending: detailPending,
    error: detailError,
  } = useQuery({
    queryKey: ["student-attendance-detail", activeTab],
    queryFn: async (): Promise<StudentAttendanceDetail> => {
      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated");

      const response = await fetch(
        `${API_BASE_URL}/api/attendance/student/${activeTab}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch student attendance");
      }

      return response.json();
    },
    enabled: !!activeTab,
    staleTime: 30000, // Keep data fresh for 30 seconds
  });

  // Download attendance PDF
  const downloadPdf = async (studentId: string, studentName: string) => {
    setDownloadingPdf(studentId);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated");

      const response = await fetch(
        `${API_BASE_URL}/api/pdf/attendance/${studentId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate PDF");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance_${studentName.replace(/\s+/g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Attendance PDF downloaded!");
    } catch (error) {
      console.error("Download error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to download PDF"
      );
    } finally {
      setDownloadingPdf(null);
    }
  };

  // Format time display
  const formatTime = (time: string | null) => {
    if (!time) return "-";
    try {
      const [hours, minutes] = time.split(":");
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? "PM" : "AM";
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch {
      return time;
    }
  };

  // Calculate hours worked
  const calculateHours = (checkIn: string | null, checkOut: string | null) => {
    if (!checkIn || !checkOut) return null;
    try {
      const inTime = new Date(`1970-01-01T${checkIn}`);
      const outTime = new Date(`1970-01-01T${checkOut}`);
      const hours = (outTime.getTime() - inTime.getTime()) / (1000 * 60 * 60);
      return hours > 0 ? hours.toFixed(1) : null;
    } catch {
      return null;
    }
  };

  // Get status badge
  const getStatusBadge = (record: AttendanceRecord) => {
    if (record.check_in_time && record.check_out_time) {
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
          <CheckCircle className="h-3 w-3 mr-1" />
          Complete
        </Badge>
      );
    }
    if (record.check_in_time) {
      return (
        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
          <Clock className="h-3 w-3 mr-1" />
          In Progress
        </Badge>
      );
    }
    return (
      <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100">
        <XCircle className="h-3 w-3 mr-1" />
        No Check-in
      </Badge>
    );
  };

  // Loading state
  if (summaryPending) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">
            Loading attendance data...
          </span>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (summaryError) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
          <p className="text-red-700 font-medium">
            Failed to load attendance data
          </p>
          <p className="text-red-600 text-sm mt-1">{summaryError.message}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => refetchSummary()}
          >
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // No students
  if (!summary?.students || summary.students.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Student Attendance
          </CardTitle>
          <CardDescription>
            Today:{" "}
            {summary?.date
              ? format(new Date(summary.date), "EEEE, MMMM d, yyyy")
              : "N/A"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No students assigned to you yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Student Attendance
              </CardTitle>
              <CardDescription>
                Today:{" "}
                {summary?.date
                  ? format(new Date(summary.date), "EEEE, MMMM d, yyyy")
                  : "N/A"}
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-base px-3 py-1">
              <Users className="h-4 w-4 mr-1" />
              {summary.students.length} Students
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            {/* Scrollable Tab List */}
            <ScrollArea className="w-full whitespace-nowrap">
              <TabsList className="inline-flex h-auto p-1 mb-4">
                {summary.students.map((student) => (
                  <TabsTrigger
                    key={student.studentId}
                    value={student.studentId}
                    className="flex items-center gap-2 px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <User className="h-4 w-4" />
                    <div className="flex flex-col items-start">
                      <span className="font-medium text-sm">
                        {student.fullName}
                      </span>
                      <span className="text-xs opacity-70">
                        {student.matricNo}
                      </span>
                    </div>
                    {/* Today's status indicator */}
                    {student.todayStatus?.checkedIn && (
                      <div className="ml-1">
                        {student.todayStatus.checkedOut ? (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        ) : (
                          <Clock className="h-3 w-3 text-amber-500" />
                        )}
                      </div>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>

            {/* Tab Content for Each Student */}
            {summary.students.map((student) => (
              <TabsContent
                key={student.studentId}
                value={student.studentId}
                className="mt-0"
              >
                {/* Student Header with Actions */}
                <div className="flex items-center justify-between mb-4 p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-primary/10">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">
                        {student.fullName}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {student.matricNo} • {student.department}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Quick Stats */}
                    <div className="hidden md:flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <span>
                          <strong>{student.daysWithCheckOut}</strong>/
                          {student.totalDays} complete
                        </span>
                      </div>
                      {student.todayStatus && (
                        <Badge
                          variant={
                            student.todayStatus.checkedOut
                              ? "default"
                              : student.todayStatus.checkedIn
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {student.todayStatus.checkedOut
                            ? "✓ Done Today"
                            : student.todayStatus.checkedIn
                            ? "Working..."
                            : "Not Started"}
                        </Badge>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setFullScreenStudent({
                            id: student.studentId,
                            name: student.fullName,
                          })
                        }
                      >
                        <Maximize2 className="h-4 w-4 mr-1" />
                        Full Screen
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          downloadPdf(student.studentId, student.fullName)
                        }
                        disabled={downloadingPdf === student.studentId}
                      >
                        {downloadingPdf === student.studentId ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <FileDown className="h-4 w-4 mr-1" />
                        )}
                        PDF
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Attendance Records Table */}
                {activeTab === student.studentId && (
                  <div className="border rounded-lg">
                    {detailPending ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="ml-2 text-muted-foreground">
                          Loading records...
                        </span>
                      </div>
                    ) : detailError ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
                        <p className="text-red-600 text-sm">
                          {detailError.message}
                        </p>
                      </div>
                    ) : studentDetail?.attendance.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <Calendar className="h-12 w-12 mb-4 opacity-30" />
                        <p>No attendance records yet</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[400px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[50px]">#</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead>Day</TableHead>
                              <TableHead>Check In</TableHead>
                              <TableHead>Check Out</TableHead>
                              <TableHead>Hours</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {studentDetail?.attendance.map((record, index) => {
                              const hours = calculateHours(
                                record.check_in_time,
                                record.check_out_time
                              );
                              return (
                                <TableRow key={record.id}>
                                  <TableCell className="text-muted-foreground">
                                    {index + 1}
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    {format(
                                      parseISO(record.date),
                                      "MMM d, yyyy"
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {format(parseISO(record.date), "EEE")}
                                  </TableCell>
                                  <TableCell>
                                    {record.check_in_time ? (
                                      <span className="flex items-center gap-1 text-green-600">
                                        <Clock className="h-3 w-3" />
                                        {formatTime(record.check_in_time)}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground">
                                        -
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {record.check_out_time ? (
                                      <span className="flex items-center gap-1 text-blue-600">
                                        <Clock className="h-3 w-3" />
                                        {formatTime(record.check_out_time)}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground">
                                        -
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {hours ? (
                                      <Badge variant="outline">
                                        {hours} hrs
                                      </Badge>
                                    ) : (
                                      <span className="text-muted-foreground">
                                        -
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell>{getStatusBadge(record)}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    )}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Full Screen Modal */}
      <FullScreenAttendanceModal
        studentId={fullScreenStudent?.id || null}
        studentName={fullScreenStudent?.name}
        onClose={() => setFullScreenStudent(null)}
      />
    </>
  );
};

export default StudentAttendanceTabsView;
