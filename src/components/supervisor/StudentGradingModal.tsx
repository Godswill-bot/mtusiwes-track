import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Award, Loader2, Calculator, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface StudentGradingModalProps {
  studentId: string;
  studentName: string;
  onGradeSubmitted: () => void;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

// Grading constants (must match backend)
const MAX_ATTENDANCE_SCORE = 10;
const MAX_WEEKLY_REPORTS_SCORE = 15;
const MAX_SUPERVISOR_APPROVAL_SCORE = 5;
const MAX_TOTAL_SCORE = 30;

interface GradeBreakdown {
  attendance: { score: number; max: number };
  weeklyReports: { score: number; max: number };
  supervisorApproval: { score: number; max: number };
  total: { score: number; max: number };
}

interface GradeData {
  score: number;
  total_score?: number;
  attendance_score?: number;
  weekly_reports_score?: number;
  supervisor_approval_score?: number;
  grade?: string;
  remarks?: string;
  breakdown?: GradeBreakdown;
}

interface PreviewData {
  student: { id: string; matricNo: string; fullName: string };
  stats: {
    attendanceDays: number;
    maxAttendanceDays: number;
    submittedWeeks: number;
    approvedWeeks: number;
    totalWeeks: number;
  };
  breakdown: GradeBreakdown;
  grade: string;
}

export const StudentGradingModal = ({ studentId, studentName, onGradeSubmitted }: StudentGradingModalProps) => {
  const [open, setOpen] = useState(false);
  const [weeklyReportsOverride, setWeeklyReportsOverride] = useState<string>("");
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [existingGrade, setExistingGrade] = useState<GradeData | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);

  const fetchPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        toast.error("Session expired. Please log in again.");
        return;
      }
      
      const response = await fetch(`${API_BASE_URL}/api/grading/preview/${studentId}`, {
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setPreview(data.data);
        } else {
          toast.error(data.error || "Failed to load grading preview");
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.error || `Failed to load preview (${response.status})`);
      }
    } catch (error) {
      console.error("Error fetching preview:", error);
      toast.error("Network error: Unable to connect to grading server");
    } finally {
      setPreviewLoading(false);
    }
  }, [studentId]);

  const fetchExistingGrade = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        return; // No session, no existing grade to fetch
      }
      
      const response = await fetch(`${API_BASE_URL}/api/grading/get-grade/${studentId}`, {
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setExistingGrade(data.data);
          if (data.data.weekly_reports_score !== undefined) {
            setWeeklyReportsOverride(data.data.weekly_reports_score.toString());
          }
          setRemarks(data.data.remarks || "");
        }
      }
    } catch (error) {
      console.error("Error fetching grade:", error);
    }
  }, [studentId]);

  useEffect(() => {
    if (open) {
      fetchPreview();
      fetchExistingGrade();
    }
  }, [open, fetchPreview, fetchExistingGrade]);

  const scoreToGrade = (score: number): string => {
    if (score >= 25) return "A";
    if (score >= 20) return "B";
    if (score >= 15) return "C";
    if (score >= 12) return "D";
    return "F";
  };

  const getGradeColor = (grade: string): string => {
    switch (grade) {
      case "A": return "text-green-600";
      case "B": return "text-blue-600";
      case "C": return "text-yellow-600";
      case "D": return "text-orange-600";
      default: return "text-red-600";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate override if provided
    if (weeklyReportsOverride && (isNaN(Number(weeklyReportsOverride)) || Number(weeklyReportsOverride) < 0 || Number(weeklyReportsOverride) > MAX_WEEKLY_REPORTS_SCORE)) {
      toast.error(`Weekly reports override must be between 0 and ${MAX_WEEKLY_REPORTS_SCORE}`);
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${API_BASE_URL}/api/grading/submit-grade`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          studentId,
          weeklyReportsOverride: weeklyReportsOverride ? Number(weeklyReportsOverride) : undefined,
          remarks,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit grade");
      }

      toast.success(`Grade ${existingGrade ? "updated" : "submitted"} successfully!`);
      setOpen(false);
      onGradeSubmitted();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to submit grade";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // Calculate preview total with any override
  const getPreviewTotal = (): number => {
    if (!preview) return 0;
    const attendance = preview.breakdown.attendance.score;
    const weekly = weeklyReportsOverride ? Number(weeklyReportsOverride) : preview.breakdown.weeklyReports.score;
    const approval = preview.breakdown.supervisorApproval.score;
    return Math.min(MAX_TOTAL_SCORE, attendance + weekly + approval);
  };

  const previewTotal = getPreviewTotal();
  const previewGrade = scoreToGrade(previewTotal);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Award className="h-4 w-4 mr-2" />
          {existingGrade ? "Update Grade" : "Grade Student"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Rule-Based Grading (30 Points)
          </DialogTitle>
          <DialogDescription>
            Grade {studentName} using the automated scoring system
          </DialogDescription>
        </DialogHeader>

        {previewLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : preview ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Statistics */}
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <Card>
                <CardContent className="pt-3 pb-2">
                  <div className="text-2xl font-bold text-blue-600">{preview.stats.attendanceDays}</div>
                  <div className="text-xs text-muted-foreground">Check-ins</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-3 pb-2">
                  <div className="text-2xl font-bold text-green-600">{preview.stats.submittedWeeks}/{preview.stats.totalWeeks}</div>
                  <div className="text-xs text-muted-foreground">Submitted</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-3 pb-2">
                  <div className="text-2xl font-bold text-purple-600">{preview.stats.approvedWeeks}/{preview.stats.submittedWeeks || 0}</div>
                  <div className="text-xs text-muted-foreground">Approved</div>
                </CardContent>
              </Card>
            </div>

            {/* Grade Breakdown */}
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
              <h4 className="font-semibold text-sm">Score Breakdown</h4>
              
              {/* Attendance */}
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-1">
                    Attendance
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                        <TooltipContent>Based on {preview.stats.attendanceDays} daily check-ins out of {preview.stats.maxAttendanceDays} expected</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </span>
                  <span className="font-medium">{preview.breakdown.attendance.score.toFixed(2)} / {MAX_ATTENDANCE_SCORE}</span>
                </div>
                <Progress value={(preview.breakdown.attendance.score / MAX_ATTENDANCE_SCORE) * 100} className="h-2" />
              </div>

              {/* Weekly Reports (Editable) */}
              <div className="space-y-1">
                <div className="flex justify-between text-sm items-center">
                  <span className="flex items-center gap-1">
                    Weekly Reports
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                        <TooltipContent>Based on {preview.stats.submittedWeeks} submitted weeks. You can override this score.</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max={MAX_WEEKLY_REPORTS_SCORE}
                      step="0.5"
                      value={weeklyReportsOverride || preview.breakdown.weeklyReports.score.toFixed(2)}
                      onChange={(e) => setWeeklyReportsOverride(e.target.value)}
                      className="w-20 h-7 text-sm"
                      disabled={loading}
                    />
                    <span className="text-muted-foreground">/ {MAX_WEEKLY_REPORTS_SCORE}</span>
                  </div>
                </div>
                <Progress 
                  value={((weeklyReportsOverride ? Number(weeklyReportsOverride) : preview.breakdown.weeklyReports.score) / MAX_WEEKLY_REPORTS_SCORE) * 100} 
                  className="h-2" 
                />
              </div>

              {/* Supervisor Approval */}
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-1">
                    Supervisor Approval
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                        <TooltipContent>Based on {preview.stats.approvedWeeks} approved out of {preview.stats.submittedWeeks || 0} submitted weeks</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </span>
                  <span className="font-medium">{preview.breakdown.supervisorApproval.score.toFixed(2)} / {MAX_SUPERVISOR_APPROVAL_SCORE}</span>
                </div>
                <Progress value={(preview.breakdown.supervisorApproval.score / MAX_SUPERVISOR_APPROVAL_SCORE) * 100} className="h-2" />
              </div>

              {/* Total */}
              <div className="pt-2 border-t">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Total Score</span>
                  <div className="text-right">
                    <span className="text-2xl font-bold">{previewTotal.toFixed(2)}</span>
                    <span className="text-muted-foreground"> / {MAX_TOTAL_SCORE}</span>
                    <span className={`ml-2 text-xl font-bold ${getGradeColor(previewGrade)}`}>
                      ({previewGrade})
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Grade Scale Reference */}
            <div className="text-xs text-muted-foreground text-center">
              A = 25-30 | B = 20-24 | C = 15-19 | D = 12-14 | F = Below 12
            </div>

            {/* Remarks */}
            <div className="space-y-2">
              <Label htmlFor="remarks">Remarks (Optional)</Label>
              <Textarea
                id="remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter your evaluation remarks..."
                rows={3}
                disabled={loading}
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Award className="h-4 w-4 mr-2" />
                    {existingGrade ? "Update Grade" : "Submit Grade"}
                  </>
                )}
              </Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            Failed to load grading preview
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};




