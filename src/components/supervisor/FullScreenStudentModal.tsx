import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Eye, Clock, CheckCircle, XCircle, 
  BookOpen, Loader2, User, Building, 
  GraduationCap, Calendar, Award
} from "lucide-react";
import { format } from "date-fns";
import { StudentGradingModal } from "./StudentGradingModal";
import { PDFDownloadButton } from "@/components/PDFDownloadButton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { apiRequest } from "@/utils/api";

interface WeekInfo {
  id: string;
  week_number: number;
  status: string;
  submitted_at: string | null;
  start_date: string;
  end_date: string;
  forwarded_to_school: boolean;
  score?: number | null;
  school_supervisor_approved_at?: string | null;
}

interface StudentWithWeeks {
  id: string;
  matric_no: string;
  department: string;
  faculty?: string;
  level?: string;
  period_of_training: string;
  organisation_name: string;
  user_id: string;
  full_name?: string;
  profile: {
    full_name: string;
  };
  weeks: WeekInfo[];
}

interface FullScreenStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentWithWeeks | null;
  onRefresh: () => void;
  onOpenReport: (weekId: string) => void;
}

export const FullScreenStudentModal = ({
  isOpen,
  onClose,
  student,
  onRefresh,
  onOpenReport,
}: FullScreenStudentModalProps) => {
  const [compilingLogbook, setCompilingLogbook] = useState(false);

  const categorizedWeeks = useMemo(() => {
    if (!student) return { pending: [], approved: [], rejected: [], all: [] };
    
    const sortedWeeks = [...student.weeks].sort((a, b) => a.week_number - b.week_number);
    
    return {
      pending: sortedWeeks.filter(w => w.status === "submitted"),
      approved: sortedWeeks.filter(w => w.status === "approved"),
      rejected: sortedWeeks.filter(w => w.status === "rejected"),
      all: sortedWeeks,
    };
  }, [student]);

  const stats = useMemo(() => {
    if (!student) return { totalWeeks: 0, avgScore: 0, completionRate: 0 };
    
    const approvedWeeks = categorizedWeeks.approved;
    const scoresWithValues = approvedWeeks.filter(w => w.score !== null && w.score !== undefined);
    const avgScore = scoresWithValues.length > 0
      ? Math.round(scoresWithValues.reduce((sum, w) => sum + (w.score || 0), 0) / scoresWithValues.length)
      : 0;
    
    return {
      totalWeeks: student.weeks.length,
      avgScore,
      completionRate: Math.round((approvedWeeks.length / 24) * 100), // Assuming 24 weeks total
    };
  }, [student, categorizedWeeks]);

  const handleCompileLogbook = async () => {
    if (!student) return;
    
    setCompilingLogbook(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Authentication required");
        return;
      }

      const response = await apiRequest('/api/pdf/compile-logbook', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ studentId: student.id }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to compile logbook');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SIWES_Logbook_${student.profile.full_name.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success("Logbook compiled and downloaded successfully!");
    } catch (error) {
      console.error("Compile logbook error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to compile logbook");
    } finally {
      setCompilingLogbook(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "submitted":
        return <Badge variant="default">Pending</Badge>;
      case "approved":
        return <Badge className="bg-green-500">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (!student) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[95vw] w-full max-h-[95vh] h-full overflow-hidden flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl">{student.profile.full_name}</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {student.matric_no} • {student.department}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StudentGradingModal 
                studentId={student.id}
                studentName={student.profile.full_name}
                onGradeSubmitted={onRefresh}
              />
              <PDFDownloadButton 
                studentId={student.id}
                type="supervisor"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleCompileLogbook}
                disabled={compilingLogbook}
              >
                {compilingLogbook ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Compiling...
                  </>
                ) : (
                  <>
                    <BookOpen className="h-4 w-4 mr-2" />
                    Compile Logbook
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Student Info Cards */}
            <div className="grid md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <Building className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Organisation</p>
                      <p className="font-medium text-sm">{student.organisation_name}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Period</p>
                      <p className="font-medium text-sm">{student.period_of_training}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-8 w-8 text-green-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Approved</p>
                      <p className="font-medium text-lg">{categorizedWeeks.approved.length} / {stats.totalWeeks}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <Award className="h-8 w-8 text-yellow-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Avg Score</p>
                      <p className="font-medium text-lg">{stats.avgScore}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Reports Tabs */}
            <Tabs defaultValue="all" className="space-y-4">
              <TabsList>
                <TabsTrigger value="all">
                  All Reports ({categorizedWeeks.all.length})
                </TabsTrigger>
                <TabsTrigger value="pending" className="flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  Pending ({categorizedWeeks.pending.length})
                </TabsTrigger>
                <TabsTrigger value="approved" className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3" />
                  Approved ({categorizedWeeks.approved.length})
                </TabsTrigger>
                <TabsTrigger value="rejected" className="flex items-center gap-2">
                  <XCircle className="h-3 w-3" />
                  Rejected ({categorizedWeeks.rejected.length})
                </TabsTrigger>
              </TabsList>

              {["all", "pending", "approved", "rejected"].map((tabKey) => (
                <TabsContent key={tabKey} value={tabKey}>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(tabKey === "all" ? categorizedWeeks.all : categorizedWeeks[tabKey as keyof typeof categorizedWeeks] as WeekInfo[]).map((week) => (
                      <Card 
                        key={week.id} 
                        className={`cursor-pointer hover:shadow-lg transition-shadow ${
                          week.status === "submitted" ? "border-yellow-200" :
                          week.status === "approved" ? "border-green-200" :
                          week.status === "rejected" ? "border-red-200" : ""
                        }`}
                        onClick={() => {
                          onClose();
                          setTimeout(() => onOpenReport(week.id), 100);
                        }}
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">Week {week.week_number}</CardTitle>
                            {getStatusBadge(week.status)}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-2">
                            {format(new Date(week.start_date), "MMM d")} - {format(new Date(week.end_date), "MMM d, yyyy")}
                          </p>
                          {week.score !== null && week.score !== undefined && (
                            <div className="flex items-center gap-2">
                              <Award className="h-4 w-4 text-yellow-500" />
                              <span className="text-sm font-medium">Score: {week.score}/100</span>
                            </div>
                          )}
                          {week.submitted_at && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Submitted: {format(new Date(week.submitted_at), "MMM d, h:mm a")}
                            </p>
                          )}
                          <Button size="sm" variant="outline" className="w-full mt-3">
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                    
                    {((tabKey === "all" && categorizedWeeks.all.length === 0) ||
                      (tabKey !== "all" && (categorizedWeeks[tabKey as keyof typeof categorizedWeeks] as WeekInfo[]).length === 0)) && (
                      <div className="col-span-full text-center py-12 text-muted-foreground">
                        No {tabKey === "all" ? "" : tabKey} reports found
                      </div>
                    )}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
