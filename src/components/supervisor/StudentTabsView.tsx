import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Eye, Clock, CheckCircle, XCircle, User, 
  Maximize2, BookOpen, Loader2, GraduationCap 
} from "lucide-react";
import { format } from "date-fns";
import { FullScreenReportModal } from "./FullScreenReportModal";
import { FullScreenStudentModal } from "./FullScreenStudentModal";
import { StudentGradingModal } from "./StudentGradingModal";
import { PDFDownloadButton } from "@/components/PDFDownloadButton";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
  school_supervisor_comments?: string | null;
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

interface StudentTabsViewProps {
  students: StudentWithWeeks[];
  onRefresh: () => void;
  onCompileLogbook: (studentId: string, studentName: string) => void;
  compilingLogbook: string | null;
}

export const StudentTabsView = ({ 
  students, 
  onRefresh, 
  onCompileLogbook,
  compilingLogbook 
}: StudentTabsViewProps) => {
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentWithWeeks | null>(null);
  const [showFullScreenStudent, setShowFullScreenStudent] = useState(false);
  const [activeStudentId, setActiveStudentId] = useState<string>(students[0]?.id || "");

  // Get sorted students by name
  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => 
      a.profile.full_name.localeCompare(b.profile.full_name)
    );
  }, [students]);

  // Get current student
  const currentStudent = useMemo(() => {
    return sortedStudents.find(s => s.id === activeStudentId) || sortedStudents[0];
  }, [sortedStudents, activeStudentId]);

  // Categorize weeks for current student
  const categorizedWeeks = useMemo(() => {
    if (!currentStudent) return { pending: [], approved: [], rejected: [] };
    
    return {
      pending: currentStudent.weeks.filter(w => w.status === "submitted"),
      approved: currentStudent.weeks.filter(w => w.status === "approved"),
      rejected: currentStudent.weeks.filter(w => w.status === "rejected"),
    };
  }, [currentStudent]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "submitted":
        return <Badge variant="default">Pending Review</Badge>;
      case "approved":
        return <Badge className="bg-green-500">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleOpenReport = (weekId: string, student: StudentWithWeeks) => {
    setSelectedStudent(student);
    setSelectedWeekId(weekId);
  };

  const handleNavigateWeek = (weekId: string) => {
    setSelectedWeekId(weekId);
  };

  const handleOpenStudentFullScreen = (student: StudentWithWeeks) => {
    setSelectedStudent(student);
    setShowFullScreenStudent(true);
  };

  const renderWeekCard = (week: WeekInfo, student: StudentWithWeeks, colorClass: string) => (
    <div
      key={week.id}
      className={`flex items-center justify-between p-3 bg-white rounded-md border ${colorClass} cursor-pointer hover:shadow-md transition-shadow`}
      onClick={() => handleOpenReport(week.id, student)}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">Week {week.week_number}</span>
          {getStatusBadge(week.status)}
          {week.score !== null && week.score !== undefined && (
            <Badge variant="outline" className="ml-2">
              Score: {week.score}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {format(new Date(week.start_date), "MMM d")} - {format(new Date(week.end_date), "MMM d, yyyy")}
        </p>
        {week.submitted_at && (
          <p className="text-xs text-muted-foreground">
            Submitted: {format(new Date(week.submitted_at), "MMM d, yyyy h:mm a")}
          </p>
        )}
        {week.school_supervisor_approved_at && (
          <p className="text-xs text-green-600">
            Approved: {format(new Date(week.school_supervisor_approved_at), "MMM d, yyyy h:mm a")}
          </p>
        )}
      </div>
      <Button size="sm" variant="outline">
        <Eye className="w-4 h-4 mr-2" />
        View
      </Button>
    </div>
  );

  if (students.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No students assigned yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Student Reports
          </CardTitle>
          <CardDescription>
            Select a student tab to view their weekly reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeStudentId} onValueChange={setActiveStudentId}>
            {/* Student Tabs */}
            <TabsList className="flex flex-wrap h-auto gap-1 mb-4 bg-muted/50 p-1">
              {sortedStudents.map((student) => {
                const pendingCount = student.weeks.filter(w => w.status === "submitted").length;
                return (
                  <TabsTrigger
                    key={student.id}
                    value={student.id}
                    className="relative data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate max-w-[150px]">{student.profile.full_name}</span>
                      {pendingCount > 0 && (
                        <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                          {pendingCount}
                        </Badge>
                      )}
                    </div>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {/* Student Content */}
            {sortedStudents.map((student) => (
              <TabsContent key={student.id} value={student.id} className="mt-0">
                {/* Student Header */}
                <div className="flex items-start justify-between p-4 bg-muted/30 rounded-lg mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">{student.profile.full_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {student.matric_no} • {student.department}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {student.organisation_name}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenStudentFullScreen(student)}
                    >
                      <Maximize2 className="h-4 w-4 mr-2" />
                      Full View
                    </Button>
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
                      onClick={() => onCompileLogbook(student.id, student.profile.full_name)}
                      disabled={compilingLogbook === student.id}
                      title="Compile all weeks into complete logbook PDF"
                    >
                      {compilingLogbook === student.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Compiling...
                        </>
                      ) : (
                        <>
                          <BookOpen className="h-4 w-4 mr-2" />
                          Compile
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Reports by Status */}
                <div className="space-y-4">
                  {/* Pending */}
                  {student.id === activeStudentId && categorizedWeeks.pending.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-yellow-700">
                        <Clock className="h-4 w-4" />
                        <h4 className="font-medium">Pending Review ({categorizedWeeks.pending.length})</h4>
                      </div>
                      <div className="space-y-2">
                        {categorizedWeeks.pending.map((week) => 
                          renderWeekCard(week, student, "border-yellow-200")
                        )}
                      </div>
                    </div>
                  )}

                  {/* Approved */}
                  {student.id === activeStudentId && categorizedWeeks.approved.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-green-700">
                        <CheckCircle className="h-4 w-4" />
                        <h4 className="font-medium">Approved ({categorizedWeeks.approved.length})</h4>
                      </div>
                      <div className="space-y-2">
                        {categorizedWeeks.approved.map((week) => 
                          renderWeekCard(week, student, "border-green-200")
                        )}
                      </div>
                    </div>
                  )}

                  {/* Rejected */}
                  {student.id === activeStudentId && categorizedWeeks.rejected.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-red-700">
                        <XCircle className="h-4 w-4" />
                        <h4 className="font-medium">Rejected ({categorizedWeeks.rejected.length})</h4>
                      </div>
                      <div className="space-y-2">
                        {categorizedWeeks.rejected.map((week) => 
                          renderWeekCard(week, student, "border-red-200")
                        )}
                      </div>
                    </div>
                  )}

                  {/* No reports */}
                  {student.id === activeStudentId && 
                   categorizedWeeks.pending.length === 0 && 
                   categorizedWeeks.approved.length === 0 && 
                   categorizedWeeks.rejected.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      No reports submitted yet for this student
                    </p>
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Full Screen Report Modal */}
      <FullScreenReportModal
        isOpen={!!selectedWeekId}
        onClose={() => {
          setSelectedWeekId(null);
          setSelectedStudent(null);
        }}
        weekId={selectedWeekId}
        studentInfo={selectedStudent ? {
          id: selectedStudent.id,
          matric_no: selectedStudent.matric_no,
          department: selectedStudent.department,
          faculty: selectedStudent.faculty,
          organisation_name: selectedStudent.organisation_name,
          full_name: selectedStudent.profile.full_name,
        } : undefined}
        onStatusChange={onRefresh}
        allWeeks={selectedStudent?.weeks.map(w => ({ id: w.id, week_number: w.week_number, status: w.status }))}
        onNavigateWeek={handleNavigateWeek}
      />

      {/* Full Screen Student Modal */}
      <FullScreenStudentModal
        isOpen={showFullScreenStudent}
        onClose={() => {
          setShowFullScreenStudent(false);
          setSelectedStudent(null);
        }}
        student={selectedStudent}
        onRefresh={onRefresh}
        onOpenReport={(weekId) => {
          setShowFullScreenStudent(false);
          setSelectedWeekId(weekId);
        }}
      />
    </>
  );
};
