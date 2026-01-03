/**
 * Full Screen Attendance Modal
 * Displays a student's complete attendance history in a fullscreen overlay
 */

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  X,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  FileDown,
  User,
  Building,
  GraduationCap,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

interface AttendanceRecord {
  id: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  verified: boolean;
  created_at: string;
}

interface StudentInfo {
  id: string;
  fullName: string;
  matricNo: string;
  department: string;
  level: string;
  organisation: string;
}

interface AttendanceStats {
  totalDays: number;
  daysWithCheckOut: number;
  verifiedDays: number;
  totalHours: number;
}

interface StudentAttendanceData {
  student: StudentInfo;
  attendance: AttendanceRecord[];
  stats: AttendanceStats;
}

interface FullScreenAttendanceModalProps {
  studentId: string | null;
  studentName?: string;
  onClose: () => void;
}

export const FullScreenAttendanceModal = ({
  studentId,
  studentName,
  onClose,
}: FullScreenAttendanceModalProps) => {
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Get auth token
  const getAuthToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  }, []);

  // Fetch student attendance data
  const { data, isPending, error } = useQuery({
    queryKey: ["student-attendance-detail", studentId],
    queryFn: async (): Promise<StudentAttendanceData> => {
      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated");

      const response = await fetch(
        `${API_BASE_URL}/api/attendance/student/${studentId}`,
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
    enabled: !!studentId,
  });

  // Download attendance PDF
  const downloadPdf = async () => {
    if (!studentId || !data) return;

    setDownloadingPdf(true);
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
      a.download = `attendance_${data.student.fullName.replace(/\s+/g, "_")}.pdf`;
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
      setDownloadingPdf(false);
    }
  };

  // Format time display
  const formatTime = (time: string | null) => {
    if (!time) return "-";
    try {
      // Handle time strings like "08:30:00"
      const [hours, minutes] = time.split(":");
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? "PM" : "AM";
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch {
      return time;
    }
  };

  // Calculate hours worked for a record
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

  // Get status badge for a record
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
          Checked In
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

  return (
    <Dialog open={!!studentId} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[95vh] max-h-[95vh] p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-primary/10 to-primary/5">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Attendance Records
              {(studentName || data?.student.fullName) && (
                <span className="text-muted-foreground font-normal">
                  — {studentName || data?.student.fullName}
                </span>
              )}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {data && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadPdf}
                  disabled={downloadingPdf}
                >
                  {downloadingPdf ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4 mr-2" />
                  )}
                  Download PDF
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {isPending ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">
                Loading attendance records...
              </span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
              <p className="text-red-700 font-medium">
                Failed to load attendance
              </p>
              <p className="text-red-600 text-sm mt-1">
                {error instanceof Error ? error.message : "Unknown error"}
              </p>
            </div>
          ) : data ? (
            <div className="h-full flex flex-col">
              {/* Student Info & Stats */}
              <div className="px-6 py-4 bg-muted/30 border-b">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Student Info */}
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-full bg-primary/10">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Student
                          </p>
                          <p className="font-medium">{data.student.fullName}</p>
                          <p className="text-sm text-muted-foreground">
                            {data.student.matricNo}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Department */}
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-full bg-blue-100">
                          <GraduationCap className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Department
                          </p>
                          <p className="font-medium">{data.student.department}</p>
                          <p className="text-sm text-muted-foreground">
                            Level {data.student.level}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Organisation */}
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-full bg-purple-100">
                          <Building className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Organisation
                          </p>
                          <p className="font-medium truncate max-w-[180px]">
                            {data.student.organisation || "Not specified"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Stats Summary */}
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-full bg-green-100">
                          <TrendingUp className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Summary
                          </p>
                          <p className="font-medium">
                            {data.stats.daysWithCheckOut} / {data.stats.totalDays} complete
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {data.stats.totalHours} hrs total
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Attendance Table */}
              <ScrollArea className="flex-1 px-6 py-4">
                {data.attendance.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <Calendar className="h-16 w-16 mb-4 opacity-30" />
                    <p className="text-lg">No attendance records yet</p>
                    <p className="text-sm">
                      Attendance will appear here once the student checks in
                    </p>
                  </div>
                ) : (
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
                        <TableHead>Verified</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.attendance.map((record, index) => {
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
                              {format(parseISO(record.date), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell>
                              {format(parseISO(record.date), "EEEE")}
                            </TableCell>
                            <TableCell>
                              {record.check_in_time ? (
                                <span className="flex items-center gap-1 text-green-600">
                                  <Clock className="h-3 w-3" />
                                  {formatTime(record.check_in_time)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {record.check_out_time ? (
                                <span className="flex items-center gap-1 text-blue-600">
                                  <Clock className="h-3 w-3" />
                                  {formatTime(record.check_out_time)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {hours ? (
                                <Badge variant="outline">{hours} hrs</Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>{getStatusBadge(record)}</TableCell>
                            <TableCell>
                              {record.verified ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FullScreenAttendanceModal;
