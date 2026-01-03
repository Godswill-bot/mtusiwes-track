/**
 * Supervisor Attendance View Component
 * Shows daily attendance for all assigned students
 */

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, Clock, CheckCircle, XCircle, Loader2, Users, Eye, FileDown, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

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

interface SupervisorAttendanceSummary {
  students: StudentAttendanceSummary[];
  date: string;
}

interface SupervisorAttendanceViewProps {
  onViewStudent?: (studentId: string) => void;
}

export const SupervisorAttendanceView = ({ onViewStudent }: SupervisorAttendanceViewProps) => {
  const { user } = useAuth();
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);

  // Get auth token
  const getAuthToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  }, []);

  // Fetch attendance summary for all assigned students
  const { data: summary, isPending, error, refetch } = useQuery({
    queryKey: ["supervisor-attendance-summary", user?.id],
    queryFn: async (): Promise<SupervisorAttendanceSummary> => {
      const token = await getAuthToken();
      if (!token) {
        console.error("[SupervisorAttendanceView] No auth token found");
        throw new Error("Not authenticated - please log in again");
      }

      console.log("[SupervisorAttendanceView] Fetching attendance summary...");
      
      try {
        const response = await fetch(`${API_BASE_URL}/api/attendance/supervisor/summary`, {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          let errorMessage = "Failed to fetch attendance summary";
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
            console.error("[SupervisorAttendanceView] API error:", errorData);
          } catch {
            console.error("[SupervisorAttendanceView] Response status:", response.status);
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log("[SupervisorAttendanceView] Attendance data loaded:", data?.students?.length || 0, "students");
        return data;
      } catch (fetchError) {
        // Handle network errors (CORS, server down, etc.)
        if (fetchError instanceof TypeError && fetchError.message === 'Failed to fetch') {
          console.error("[SupervisorAttendanceView] Network error - server may be down or CORS issue");
          throw new Error("Cannot connect to server. Please ensure the backend is running.");
        }
        throw fetchError;
      }
    },
    enabled: !!user?.id,
    refetchInterval: 60000, // Refresh every minute
    retry: 2, // Retry failed requests up to 2 times
    retryDelay: 1000, // Wait 1 second between retries
  });

  // Download attendance PDF for a student
  const downloadAttendancePdf = async (studentId: string, studentName: string) => {
    setDownloadingPdf(studentId);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated");

      const response = await fetch(`${API_BASE_URL}/api/pdf/attendance/${studentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

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
      toast.error(error instanceof Error ? error.message : "Failed to download PDF");
    } finally {
      setDownloadingPdf(null);
    }
  };

  if (isPending) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading attendance data...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
          <p className="text-red-700 font-medium">Failed to load attendance data</p>
          <p className="text-red-600 text-sm mt-1">{error.message}</p>
          <Button variant="outline" className="mt-4" onClick={() => refetch()}>
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Student Attendance
            </CardTitle>
            <CardDescription>
              Today: {summary?.date ? format(new Date(summary.date), "EEEE, MMMM d, yyyy") : "N/A"}
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-base px-3 py-1">
            <Users className="h-4 w-4 mr-1" />
            {summary?.students.length || 0} Students
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {!summary?.students || summary.students.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No students assigned to you yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Today's Status</TableHead>
                  <TableHead className="text-center">Total Days</TableHead>
                  <TableHead className="text-center">Complete Days</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.students.map((student) => (
                  <TableRow key={student.studentId}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{student.fullName}</p>
                        <p className="text-sm text-muted-foreground">
                          {student.matricNo} • {student.department}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {student.todayStatus ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            {student.todayStatus.checkedIn ? (
                              <>
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                <span className="text-sm">
                                  In: {student.todayStatus.checkInTime || "N/A"}
                                </span>
                              </>
                            ) : (
                              <>
                                <XCircle className="h-4 w-4 text-gray-400" />
                                <span className="text-sm text-muted-foreground">Not checked in</span>
                              </>
                            )}
                          </div>
                          {student.todayStatus.checkedIn && (
                            <div className="flex items-center gap-2">
                              {student.todayStatus.checkedOut ? (
                                <>
                                  <CheckCircle className="h-4 w-4 text-blue-500" />
                                  <span className="text-sm">
                                    Out: {student.todayStatus.checkOutTime || "N/A"}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Clock className="h-4 w-4 text-amber-500" />
                                  <span className="text-sm text-amber-600">Still working</span>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="h-3 w-3 mr-1" />
                          Absent
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{student.totalDays}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-green-50">
                        {student.daysWithCheckOut}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {onViewStudent && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onViewStudent(student.studentId)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadAttendancePdf(student.studentId, student.fullName)}
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SupervisorAttendanceView;
