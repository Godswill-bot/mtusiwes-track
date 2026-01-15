import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  X, Check, Printer, Download, Stamp, 
  ArrowLeft, ArrowRight, Maximize2, Minimize2, 
  Loader2, ChevronLeft, ChevronRight, User 
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toZonedTime } from "date-fns-tz";

interface StampData {
  id: string;
  week_id: string;
  method: string;
  image_path: string | null;
  signed_at: string;
  supervisor_id: string | null;
}

interface WeekData {
  id: string;
  week_number: number;
  start_date: string;
  end_date: string;
  monday_activity: string | null;
  tuesday_activity: string | null;
  wednesday_activity: string | null;
  thursday_activity: string | null;
  friday_activity: string | null;
  saturday_activity: string | null;
  comments: string | null;
  status: string;
  submitted_at: string | null;
  image_urls?: string[] | null;
  score?: number | null;
  school_supervisor_approved_at?: string | null;
  school_supervisor_comments?: string | null;
  rejection_reason?: string | null;
}

interface StudentInfo {
  id: string;
  matric_no: string;
  department: string;
  faculty?: string;
  organisation_name: string;
  full_name: string;
  profile_image_url?: string | null;
}

interface FullScreenReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  weekId: string | null;
  studentInfo?: StudentInfo;
  onStatusChange?: () => void;
  allWeeks?: { id: string; week_number: number; status: string }[];
  onNavigateWeek?: (weekId: string) => void;
}

export const FullScreenReportModal = ({
  isOpen,
  onClose,
  weekId,
  studentInfo,
  onStatusChange,
  allWeeks,
  onNavigateWeek,
}: FullScreenReportModalProps) => {
  const { user, userRole } = useAuth();
  const queryClient = useQueryClient();
  const [weekData, setWeekData] = useState<WeekData | null>(null);
  const [loading, setLoading] = useState(false);
  const [stamps, setStamps] = useState<StampData[]>([]);
  const [schoolComments, setSchoolComments] = useState("");
  const [score, setScore] = useState<number | "">("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [uploading, setUploading] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  const fetchWeekData = useCallback(async () => {
    if (!weekId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("weeks")
        .select("*")
        .eq("id", weekId)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setWeekData(data as WeekData);
        setSchoolComments((data as WeekData).school_supervisor_comments || "");
        setScore((data as WeekData).score || "");
      }

      // Fetch stamps
      const { data: stampData } = await supabase
        .from("stamps")
        .select("id, week_id, method, image_path, signed_at, supervisor_id")
        .eq("week_id", weekId)
        .order("signed_at", { ascending: false });
      
      setStamps(stampData || []);
    } catch (error) {
      console.error("Error loading week data:", error);
      toast.error("Error loading week data");
    } finally {
      setLoading(false);
    }
  }, [weekId]);

  useEffect(() => {
    if (isOpen && weekId) {
      fetchWeekData();
      setRejectionReason("");
    }
  }, [isOpen, weekId, fetchWeekData]);

  const handleSchoolApprove = async () => {
    if (!weekData || !user) return;

    if (score !== "" && (Number(score) < 0 || Number(score) > 100)) {
      toast.error("Score must be between 0 and 100");
      return;
    }

    setUploading(true);
    try {
      const lagosTime = toZonedTime(new Date(), 'Africa/Lagos');
      
      const { data: supervisorData } = await supabase
        .from("supervisors")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      
      const { error } = await supabase
        .from("weeks")
        .update({ 
          status: "approved",
          school_supervisor_approved_at: lagosTime.toISOString(),
          school_supervisor_id: supervisorData?.id || null,
          school_supervisor_comments: schoolComments || null,
          score: score === "" ? null : Number(score)
        })
        .eq("id", weekData.id);

      if (error) throw error;

      toast.success("Week approved successfully!");
      
      queryClient.invalidateQueries({ queryKey: ["weeks"] });
      queryClient.invalidateQueries({ queryKey: ["student-weeks"] });
      
      onStatusChange?.();
      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to approve week";
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleSchoolReject = async () => {
    if (!weekData || !user) return;

    if (!rejectionReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    setUploading(true);
    try {
      const lagosTime = toZonedTime(new Date(), 'Africa/Lagos');
      
      const { error } = await supabase
        .from("weeks")
        .update({ 
          status: "rejected",
          rejection_reason: rejectionReason,
          school_supervisor_comments: schoolComments || null,
          school_approved_at: lagosTime.toISOString()
        })
        .eq("id", weekData.id);

      if (error) throw error;

      toast.success("Week rejected");
      
      queryClient.invalidateQueries({ queryKey: ["weeks"] });
      queryClient.invalidateQueries({ queryKey: ["student-weeks"] });
      
      onStatusChange?.();
      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to reject week";
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!weekData) return;
    
    try {
      toast.info("Generating PDF...");
      
      const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${API_BASE_URL}/api/pdf/generate-week-pdf`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({ weekId: weekData.id }),
      });
      
      if (!response.ok) {
        window.print();
        return;
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Week_${weekData.week_number}_Report.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success("PDF downloaded successfully!");
    } catch (error) {
      toast.error("Failed to generate PDF");
      console.error(error);
    }
  };

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

  // Find current week index for navigation
  const currentIndex = allWeeks?.findIndex(w => w.id === weekId) ?? -1;
  const prevWeek = currentIndex > 0 ? allWeeks?.[currentIndex - 1] : null;
  const nextWeek = currentIndex < (allWeeks?.length ?? 0) - 1 ? allWeeks?.[currentIndex + 1] : null;

  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const isSchoolSupervisor = userRole === "school_supervisor";
  const canSchoolAct = isSchoolSupervisor && weekData?.status === "submitted";

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-[95vw] w-full max-h-[95vh] h-full overflow-hidden flex flex-col p-0">
          {/* Header */}
          <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Navigation arrows */}
                {allWeeks && allWeeks.length > 1 && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!prevWeek}
                      onClick={() => prevWeek && onNavigateWeek?.(prevWeek.id)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {currentIndex + 1} / {allWeeks.length}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!nextWeek}
                      onClick={() => nextWeek && onNavigateWeek?.(nextWeek.id)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <div>
                  <DialogTitle className="text-xl">
                    Week {weekData?.week_number} - Weekly Report
                  </DialogTitle>
                  {weekData && (
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(weekData.start_date), "MMM d")} - {format(new Date(weekData.end_date), "MMM d, yyyy")}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {weekData && getStatusBadge(weekData.status)}
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : !weekData ? (
              <div className="text-center py-8 text-muted-foreground">
                Week not found
              </div>
            ) : (
              <div className="space-y-6 max-w-5xl mx-auto">
                {/* Student Info with Profile Picture */}
                {studentInfo && (
                  <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                    {/* Profile Picture */}
                    <Avatar className="h-20 w-20 border-2 border-primary/20 shadow-md flex-shrink-0">
                      <AvatarImage 
                        src={studentInfo.profile_image_url || undefined} 
                        alt={studentInfo.full_name}
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
                        {studentInfo.full_name
                          .split(" ")
                          .map(n => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    
                    {/* Student Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
                      <div>
                        <p className="text-sm text-muted-foreground">Student Name</p>
                        <p className="font-medium">{studentInfo.full_name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Matric No.</p>
                        <p className="font-medium">{studentInfo.matric_no}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Department</p>
                        <p className="font-medium">{studentInfo.department}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Organisation</p>
                        <p className="font-medium">{studentInfo.organisation_name}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Submitted at */}
                {weekData.submitted_at && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-sm text-blue-900 dark:text-blue-100">
                      Submitted on: {format(new Date(weekData.submitted_at), "MMMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                )}

                {/* Daily Activities */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Daily Activities</h3>
                  <div className="grid gap-3">
                    {days.map((day, index) => {
                      const activity = weekData[`${day}_activity` as keyof WeekData] as string | null;
                      
                      return (
                        <Card key={day}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium capitalize">{day}</h4>
                              <span className="text-sm text-muted-foreground">
                                {format(new Date(new Date(weekData.start_date).getTime() + index * 24 * 60 * 60 * 1000), "MMM d, yyyy")}
                              </span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">
                              {activity || <span className="text-muted-foreground italic">No activity logged</span>}
                            </p>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                {/* Evidence Images */}
                {weekData.image_urls && weekData.image_urls.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg">Evidence Photos</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {weekData.image_urls.map((imageUrl, index) => (
                        <div 
                          key={index} 
                          className="relative group cursor-pointer"
                          onClick={() => setExpandedImage(imageUrl)}
                        >
                          <img
                            src={imageUrl}
                            alt={`Evidence ${index + 1}`}
                            className="w-full h-40 object-cover rounded-lg border hover:opacity-80 transition-opacity"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-all rounded-lg">
                            <Maximize2 className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Digital Stamps */}
                {stamps.length > 0 && (
                  <div className="space-y-3 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Stamp className="h-5 w-5 text-green-600" />
                      <Label className="text-green-800 dark:text-green-200 font-semibold">Digital Stamps & Signatures</Label>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {stamps.map((stamp) => (
                        <div key={stamp.id} className="space-y-2">
                          {stamp.image_path ? (
                            <img
                              src={stamp.image_path}
                              alt={stamp.method === 'signature' ? 'Signature' : 'Stamp'}
                              className="max-h-24 max-w-full object-contain border border-green-300 rounded-md bg-white p-2 cursor-pointer hover:opacity-80"
                              onClick={() => setExpandedImage(stamp.image_path!)}
                            />
                          ) : (
                            <div className="h-20 border border-dashed border-green-300 rounded-md flex items-center justify-center text-sm text-muted-foreground">
                              No image
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {stamp.method === 'signature' ? '✍️ Signature' : '🔖 Stamp'} • {format(new Date(stamp.signed_at), "MMM d, yyyy")}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Student Comments */}
                {weekData.comments && (
                  <div className="space-y-2">
                    <Label>Student Comments</Label>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm whitespace-pre-wrap">{weekData.comments}</p>
                    </div>
                  </div>
                )}

                {/* Existing Score/Approval Info */}
                {weekData.status === "approved" && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-green-600" />
                      <span className="font-semibold text-green-800">Approved</span>
                    </div>
                    {weekData.score !== null && weekData.score !== undefined && (
                      <p className="text-sm">Score: <strong>{weekData.score}/100</strong></p>
                    )}
                    {weekData.school_supervisor_approved_at && (
                      <p className="text-sm text-muted-foreground">
                        Approved on: {format(new Date(weekData.school_supervisor_approved_at), "MMM d, yyyy h:mm a")}
                      </p>
                    )}
                    {weekData.school_supervisor_comments && (
                      <div className="mt-2 p-2 bg-white rounded border">
                        <p className="text-xs text-muted-foreground mb-1">Supervisor Comments:</p>
                        <p className="text-sm">{weekData.school_supervisor_comments}</p>
                      </div>
                    )}
                  </div>
                )}

                {weekData.status === "rejected" && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <X className="h-5 w-5 text-red-600" />
                      <span className="font-semibold text-red-800">Rejected</span>
                    </div>
                    {weekData.rejection_reason && (
                      <div className="mt-2 p-2 bg-white rounded border">
                        <p className="text-xs text-muted-foreground mb-1">Rejection Reason:</p>
                        <p className="text-sm">{weekData.rejection_reason}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions for Pending */}
                {canSchoolAct && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Supervisor Comments (Optional)</Label>
                        <Textarea
                          value={schoolComments}
                          onChange={(e) => setSchoolComments(e.target.value)}
                          placeholder="Add your comments or feedback..."
                          rows={3}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Assessment Score (0-100)</Label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={score}
                            onChange={(e) => setScore(e.target.value === "" ? "" : Number(e.target.value))}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 max-w-[150px]"
                            placeholder="Score"
                          />
                          <span className="text-sm text-muted-foreground">/ 100</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-4">
                      <Button onClick={handleSchoolApprove} className="flex-1" disabled={uploading}>
                        <Check className="h-4 w-4 mr-2" />
                        {uploading ? "Approving..." : "Approve & Grade"}
                      </Button>
                    </div>

                    <div className="space-y-2 pt-4 border-t">
                      <Label>Rejection Reason (Required for rejection)</Label>
                      <Textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Provide feedback for rejection..."
                        rows={3}
                      />
                      <Button 
                        onClick={handleSchoolReject} 
                        variant="destructive" 
                        disabled={!rejectionReason.trim() || uploading}
                        className="w-full"
                      >
                        <X className="h-4 w-4 mr-2" />
                        {uploading ? "Rejecting..." : "Reject Submission"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Lightbox */}
      <Dialog open={!!expandedImage} onOpenChange={(open) => !open && setExpandedImage(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-2">
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 bg-black/50 text-white hover:bg-black/70"
              onClick={() => setExpandedImage(null)}
            >
              <X className="h-4 w-4" />
            </Button>
            {expandedImage && (
              <img
                src={expandedImage}
                alt="Expanded view"
                className="w-full h-auto max-h-[85vh] object-contain rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
