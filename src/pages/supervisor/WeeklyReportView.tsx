import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { ArrowLeft, Check, X, FileSignature, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

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
  student: {
    matric_no: string;
    department: string;
    faculty: string;
    period_of_training: string;
    organisation_name: string;
    user_id: string;
  };
  profile: {
    full_name: string;
  };
}

const WeeklyReportView = () => {
  const { weekId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [weekData, setWeekData] = useState<WeekData | null>(null);
  const [photos, setPhotos] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [rejectionReason, setRejectionReason] = useState("");
  const [stampFile, setStampFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchWeekData();
  }, [weekId]);

  const fetchWeekData = async () => {
    if (!weekId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("weeks")
        .select(`
          *,
          student:students!inner(
            matric_no,
            department,
            faculty,
            period_of_training,
            organisation_name,
            user_id
          )
        `)
        .eq("id", weekId)
        .single();

      if (error) throw error;

      // Fetch student profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", data.student.user_id)
        .single();

      if (profileError) throw profileError;

      setWeekData({ ...data, profile: profileData });
      fetchPhotos(weekId);
    } catch (error: any) {
      toast.error("Error loading week data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPhotos = async (wkId: string) => {
    try {
      const { data, error } = await supabase
        .from("photos")
        .select("*")
        .eq("week_id", wkId)
        .order("uploaded_at", { ascending: true });

      if (error) throw error;

      const photosByDay: Record<string, any[]> = {};
      data?.forEach((photo) => {
        if (!photosByDay[photo.day_of_week]) {
          photosByDay[photo.day_of_week] = [];
        }
        photosByDay[photo.day_of_week].push(photo);
      });
      setPhotos(photosByDay);
    } catch (error) {
      console.error("Error fetching photos:", error);
    }
  };

  const handleApprove = async () => {
    if (!weekData || !user) return;

    try {
      const { error } = await supabase
        .from("weeks")
        .update({ 
          status: "approved",
          forwarded_to_school: true
        })
        .eq("id", weekData.id);

      if (error) throw error;

      toast.success("Week approved and forwarded to school supervisor");
      navigate("/supervisor/dashboard");
    } catch (error: any) {
      toast.error("Error approving week");
      console.error(error);
    }
  };

  const handleReject = async () => {
    if (!weekData || !rejectionReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    try {
      const { error } = await supabase
        .from("weeks")
        .update({ 
          status: "rejected",
          rejection_reason: rejectionReason
        })
        .eq("id", weekData.id);

      if (error) throw error;

      toast.success("Week rejected");
      navigate("/supervisor/dashboard");
    } catch (error: any) {
      toast.error("Error rejecting week");
      console.error(error);
    }
  };

  const handleStampUpload = async () => {
    if (!stampFile || !weekData || !user) return;

    setUploading(true);
    try {
      // Upload stamp to storage
      const fileExt = stampFile.name.split('.').pop();
      const fileName = `${user.id}_${Date.now()}.${fileExt}`;
      const filePath = `stamps/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("student-photos")
        .upload(filePath, stampFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("student-photos")
        .getPublicUrl(filePath);

      // Create stamp record
      const { error: stampError } = await supabase
        .from("stamps")
        .insert({
          week_id: weekData.id,
          supervisor_id: user.id,
          method: "upload",
          proof_hash: `hash_${Date.now()}`,
          image_path: publicUrl
        });

      if (stampError) throw stampError;

      toast.success("Stamp uploaded successfully");
      handleApprove();
    } catch (error: any) {
      toast.error("Error uploading stamp");
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!weekData) {
    return (
      <div className="min-h-screen bg-gradient-light">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <p className="text-center text-muted-foreground">Week not found</p>
        </main>
      </div>
    );
  }

  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

  return (
    <div className="min-h-screen bg-gradient-light">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => navigate("/supervisor/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <Badge variant={weekData.status === "submitted" ? "secondary" : "default"}>
              {weekData.status}
            </Badge>
          </div>

          <Card className="shadow-elevated">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">Week {weekData.week_number} Report</CardTitle>
                  <CardDescription>
                    {format(new Date(weekData.start_date), "MMM dd")} - {format(new Date(weekData.end_date), "MMM dd, yyyy")}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Student Name</p>
                  <p className="font-semibold">{weekData.profile.full_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Matric Number</p>
                  <p className="font-semibold">{weekData.student.matric_no}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Department</p>
                  <p className="font-semibold">{weekData.student.department}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Training Period</p>
                  <p className="font-semibold">{weekData.student.period_of_training}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm text-muted-foreground">Organisation</p>
                  <p className="font-semibold">{weekData.student.organisation_name}</p>
                </div>
              </div>

              {days.map((day) => {
                const activity = weekData[`${day}_activity` as keyof WeekData];
                if (!activity) return null;

                return (
                  <div key={day} className="space-y-3 p-4 border border-border rounded-lg">
                    <div className="flex items-center justify-between">
                      <label className="font-medium capitalize text-lg">{day}</label>
                      <span className="text-sm text-muted-foreground">
                        {format(addDays(new Date(weekData.start_date), days.indexOf(day)), "MMM dd")}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{activity as string}</p>
                    
                    {photos[day] && photos[day].length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Photos:</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {photos[day].map((photo) => (
                            <div key={photo.id} className="space-y-1">
                              <img
                                src={photo.image_url}
                                alt={photo.description || "Activity photo"}
                                className="w-full h-32 object-cover rounded-lg border"
                              />
                              {photo.description && (
                                <p className="text-xs text-muted-foreground">{photo.description}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {weekData.comments && (
                <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                  <label className="font-medium">Student Comments</label>
                  <p className="text-sm whitespace-pre-wrap">{weekData.comments}</p>
                </div>
              )}

              {weekData.status === "submitted" && (
                <div className="flex flex-col space-y-4 pt-6 border-t">
                  <div className="flex space-x-4">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button className="flex-1">
                          <FileSignature className="h-4 w-4 mr-2" />
                          Add Stamp & Approve
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Upload Digital Stamp</DialogTitle>
                          <DialogDescription>
                            Upload your company stamp or signature to approve this week
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="stamp">Stamp/Signature Image (PNG recommended)</Label>
                            <Input
                              id="stamp"
                              type="file"
                              accept="image/*"
                              onChange={(e) => setStampFile(e.target.files?.[0] || null)}
                            />
                            <p className="text-xs text-muted-foreground">
                              Max size: 3MB. Transparent PNG works best.
                            </p>
                          </div>
                          <Button 
                            onClick={handleStampUpload} 
                            disabled={!stampFile || uploading}
                            className="w-full"
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            {uploading ? "Uploading..." : "Upload & Approve"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Button onClick={handleApprove} variant="outline" className="flex-1">
                      <Check className="h-4 w-4 mr-2" />
                      Approve Without Stamp
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label>Rejection Reason</Label>
                    <Textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Provide feedback for rejection..."
                      rows={3}
                    />
                    <Button 
                      onClick={handleReject} 
                      variant="destructive" 
                      disabled={!rejectionReason.trim()}
                      className="w-full"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Reject Submission
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default WeeklyReportView;
