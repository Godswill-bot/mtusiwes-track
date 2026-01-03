import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Download, Info, Calendar } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type AttendanceRecord = Database["public"]["Tables"]["attendance"]["Row"] & {
  student?: {
    full_name: string | null;
    matric_no: string;
  } | null;
};

const fetchAttendance = async () => {
  const { data, error } = await supabase
    .from("attendance")
    .select("*, student:students(full_name, matric_no)")
    .order("date", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data as AttendanceRecord[];
};

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

/**
 * Admin Attendance View Panel
 * 
 * IMPORTANT: As per Phase 7 requirements, Admin can ONLY view attendance records.
 * - Students check themselves in/out via the student portal
 * - Supervisors view and download attendance PDFs
 * - Admin has READ-ONLY access for oversight
 */
export const AttendanceControlPanel = () => {
  const { toast } = useToast();
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);

  const attendanceQuery = useQuery({
    queryKey: ["admin", "attendance"],
    queryFn: fetchAttendance,
  });

  // Group attendance by student for summary
  const attendanceByStudent = attendanceQuery.data?.reduce((acc, record) => {
    const studentId = record.student_id;
    if (!acc[studentId]) {
      acc[studentId] = {
        student: record.student,
        records: [],
        totalDays: 0,
        completeDays: 0
      };
    }
    acc[studentId].records.push(record);
    acc[studentId].totalDays++;
    if (record.check_in_time && record.check_out_time) {
      acc[studentId].completeDays++;
    }
    return acc;
  }, {} as Record<string, { student: typeof attendanceQuery.data[0]["student"]; records: AttendanceRecord[]; totalDays: number; completeDays: number }>);

  // Download attendance PDF
  const downloadAttendancePdf = async (studentId: string, studentName: string) => {
    setDownloadingPdf(studentId);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(`${API_BASE_URL}/api/pdf/attendance/${studentId}`, {
        headers: { Authorization: `Bearer ${session.session.access_token}` }
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
      toast({ title: "PDF downloaded successfully" });
    } catch (error) {
      console.error("Download error:", error);
      toast({ 
        title: "Download failed", 
        description: error instanceof Error ? error.message : "Unknown error", 
        variant: "destructive" 
      });
    } finally {
      setDownloadingPdf(null);
    }
  };

  return (
    <Card className="shadow-card h-full flex flex-col">
      <CardHeader className="pb-4 border-b flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-xl sm:text-2xl flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Attendance Records
            </CardTitle>
            <CardDescription>
              View student attendance records (Read-Only)
            </CardDescription>
          </div>
          <Badge variant="outline" className="w-fit">
            {attendanceQuery.data?.length || 0} Records
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 pt-6 overflow-hidden flex flex-col min-h-0">
        {/* Info Alert */}
        <Alert className="mb-4 bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800">Student Self-Service Attendance</AlertTitle>
          <AlertDescription className="text-blue-700">
            Students check themselves in/out daily via the student portal. 
            This panel is for viewing records only. Supervisors can download attendance PDFs.
          </AlertDescription>
        </Alert>

        <div className="overflow-x-auto overflow-y-auto flex-1 -mx-1 px-1">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="min-w-[150px]">Student</TableHead>
                <TableHead className="min-w-[100px]">Date</TableHead>
                <TableHead className="min-w-[100px]">Check-in</TableHead>
                <TableHead className="min-w-[100px]">Check-out</TableHead>
                <TableHead className="min-w-[100px]">Status</TableHead>
                <TableHead className="text-right min-w-[100px]">PDF</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendanceQuery.isPending ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="flex items-center justify-center">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading attendance records...
                    </div>
                  </TableCell>
                </TableRow>
              ) : attendanceQuery.data && attendanceQuery.data.length > 0 ? (
                attendanceQuery.data.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="max-w-[150px]">
                      <div className="font-medium break-words">{record.student?.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground break-words">{record.student?.matric_no}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{record.date}</TableCell>
                    <TableCell className="whitespace-nowrap">{record.check_in_time ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{record.check_out_time ?? "—"}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={record.check_in_time && record.check_out_time ? "default" : "secondary"} 
                        className="whitespace-nowrap"
                      >
                        {record.check_in_time && record.check_out_time 
                          ? "Complete" 
                          : record.check_in_time 
                            ? "In Progress"
                            : "Absent"
                        }
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => downloadAttendancePdf(
                          record.student_id, 
                          record.student?.full_name || "Student"
                        )}
                        disabled={downloadingPdf === record.student_id}
                      >
                        {downloadingPdf === record.student_id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="h-8 w-8 opacity-50" />
                      <p>No attendance records found</p>
                      <p className="text-sm">Students will check in via their dashboard</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};


