import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Save, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PhotoUpload } from "@/components/PhotoUpload";

interface Week {
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
  status: "draft" | "submitted" | "approved" | "rejected";
}

const Logbook = () => {
  const { user } = useAuth();
  const [studentId, setStudentId] = useState<string | null>(null);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [weekData, setWeekData] = useState<Week | null>(null);
  const [photos, setPhotos] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchStudentId();
  }, [user]);

  useEffect(() => {
    if (studentId) {
      fetchWeekData();
    }
  }, [studentId, currentWeek]);

  const fetchStudentId = async () => {
    try {
      const { data, error } = await supabase
        .from("students")
        .select("id")
        .eq("user_id", user?.id)
        .single();

      if (error) throw error;
      setStudentId(data.id);
    } catch (error) {
      toast.error("Error loading student data");
      console.error(error);
    }
  };

  const fetchWeekData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("weeks")
        .select("*")
        .eq("student_id", studentId)
        .eq("week_number", currentWeek)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setWeekData(data);
        fetchPhotos(data.id);
      } else {
        // Create new week
        const today = new Date();
        const weekStart = startOfWeek(today, { weekStartsOn: 1 });
        const weekEnd = addDays(weekStart, 5);

        setWeekData({
          id: "",
          week_number: currentWeek,
          start_date: format(weekStart, "yyyy-MM-dd"),
          end_date: format(weekEnd, "yyyy-MM-dd"),
          monday_activity: "",
          tuesday_activity: "",
          wednesday_activity: "",
          thursday_activity: "",
          friday_activity: "",
          saturday_activity: "",
          comments: "",
          status: "draft",
        });
        setPhotos({});
      }
    } catch (error) {
      toast.error("Error loading week data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPhotos = async (weekId: string) => {
    try {
      const { data, error } = await supabase
        .from("photos")
        .select("*")
        .eq("week_id", weekId)
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

  const handleSave = async (submit: boolean = false) => {
    if (!weekData || !studentId) return;

    setSaving(true);
    try {
      const dataToSave = {
        student_id: studentId,
        week_number: currentWeek,
        start_date: weekData.start_date,
        end_date: weekData.end_date,
        monday_activity: weekData.monday_activity,
        tuesday_activity: weekData.tuesday_activity,
        wednesday_activity: weekData.wednesday_activity,
        thursday_activity: weekData.thursday_activity,
        friday_activity: weekData.friday_activity,
        saturday_activity: weekData.saturday_activity,
        comments: weekData.comments,
        status: submit ? ("submitted" as const) : ("draft" as const),
        submitted_at: submit ? new Date().toISOString() : null,
      };

      if (weekData.id) {
        const { error } = await supabase
          .from("weeks")
          .update(dataToSave)
          .eq("id", weekData.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("weeks")
          .insert(dataToSave)
          .select()
          .single();

        if (error) throw error;
        setWeekData({ ...weekData, id: data.id });
      }

      toast.success(submit ? "Week submitted successfully!" : "Week saved as draft");
      fetchWeekData();
    } catch (error: any) {
      toast.error(error.message || "Failed to save week");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const updateActivity = (day: string, value: string) => {
    if (!weekData) return;
    setWeekData({ ...weekData, [`${day}_activity`]: value });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "secondary",
      submitted: "default",
      approved: "default",
      rejected: "destructive",
    };

    return (
      <Badge variant={variants[status] || "outline"} className="capitalize">
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  const canEdit = weekData?.status === "draft" || !weekData?.id;

  return (
    <div className="min-h-screen bg-gradient-light">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-primary">Weekly Logbook</h1>
              <p className="text-muted-foreground">Week {currentWeek}</p>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentWeek(Math.max(1, currentWeek - 1))}
                disabled={currentWeek === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-semibold px-4">Week {currentWeek}</span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentWeek(currentWeek + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {weekData && (
            <Card className="shadow-elevated">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>
                      {format(new Date(weekData.start_date), "MMM dd")} -{" "}
                      {format(new Date(weekData.end_date), "MMM dd, yyyy")}
                    </CardTitle>
                    <CardDescription>Record your daily activities</CardDescription>
                  </div>
                  {getStatusBadge(weekData.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].map((day) => (
                  <div key={day} className="space-y-3 p-4 border border-border rounded-lg">
                    <div className="flex items-center justify-between">
                      <label className="font-medium capitalize text-lg">{day}</label>
                      <span className="text-sm text-muted-foreground">
                        {format(addDays(new Date(weekData.start_date), ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].indexOf(day)), "MMM dd")}
                      </span>
                    </div>
                    <Textarea
                      value={weekData[`${day}_activity` as keyof Week] as string || ""}
                      onChange={(e) => updateActivity(day, e.target.value)}
                      placeholder={`Describe your ${day} activities...`}
                      rows={3}
                      disabled={!canEdit}
                    />
                    {weekData.id && (
                      <PhotoUpload
                        weekId={weekData.id}
                        day={day}
                        photos={photos[day] || []}
                        onPhotosChange={() => fetchPhotos(weekData.id)}
                        disabled={!canEdit}
                      />
                    )}
                  </div>
                ))}

                <div className="space-y-2">
                  <label className="font-medium">Comments/Notes</label>
                  <Textarea
                    value={weekData.comments || ""}
                    onChange={(e) => setWeekData({ ...weekData, comments: e.target.value })}
                    placeholder="Additional comments or observations..."
                    rows={4}
                    disabled={!canEdit}
                  />
                </div>

                {canEdit && (
                  <div className="flex space-x-4 pt-4">
                    <Button onClick={() => handleSave(false)} disabled={saving} variant="outline">
                      <Save className="h-4 w-4 mr-2" />
                      Save Draft
                    </Button>
                    <Button onClick={() => handleSave(true)} disabled={saving}>
                      <Send className="h-4 w-4 mr-2" />
                      Submit for Approval
                    </Button>
                  </div>
                )}

                {weekData.status === "rejected" && (
                  <div className="p-4 bg-destructive/10 border border-destructive rounded-lg">
                    <p className="text-sm font-medium text-destructive">
                      This week has been rejected. Please review supervisor feedback and resubmit.
                    </p>
                  </div>
                )}

                {weekData.status === "approved" && (
                  <div className="p-4 bg-primary/10 border border-primary rounded-lg">
                    <p className="text-sm font-medium text-primary">
                      ✓ This week has been approved by your supervisor
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default Logbook;
