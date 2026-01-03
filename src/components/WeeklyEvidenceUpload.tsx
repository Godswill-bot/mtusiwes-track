import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, X, Image as ImageIcon, Calendar } from "lucide-react";
import { format } from "date-fns";
import { FadeIn, SlideUp } from "@/components/animations/MotionWrappers";
import { AnimatedIcon } from "@/components/icons/icons";

interface EvidenceUpload {
  id: string;
  student_id: string;
  week_number: number;
  day: string;
  image_url: string;
  created_at: string;
}

interface WeeklyEvidenceUploadProps {
  studentId: string;
  weekNumber: number;
}

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export const WeeklyEvidenceUpload = ({ studentId, weekNumber }: WeeklyEvidenceUploadProps) => {
  const [uploads, setUploads] = useState<Record<string, EvidenceUpload>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    fetchUploads();
  }, [studentId, weekNumber, fetchUploads]);

  const fetchUploads = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("student_evidence_uploads")
        .select("*")
        .eq("student_id", studentId)
        .eq("week_number", weekNumber);

      if (error) throw error;

      const uploadsMap: Record<string, EvidenceUpload> = {};
      data?.forEach((upload) => {
        uploadsMap[upload.day] = upload;
      });
      setUploads(uploadsMap);
    } catch (error: unknown) {
      toast.error("Failed to load uploads");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [studentId, weekNumber]);

  const handleFileUpload = async (day: string, file: File) => {
    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    // Validate file type (JPG/PNG only)
    const validTypes = ["image/jpeg", "image/jpg", "image/png"];
    if (!validTypes.includes(file.type.toLowerCase())) {
      toast.error("Only JPG and PNG files are allowed");
      return;
    }

    setUploading({ ...uploading, [day]: true });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create file path: studentId/week{weekNumber}/{day}.jpg
      const fileExt = file.name.split(".").pop() || "jpg";
      const filePath = `${studentId}/week${weekNumber}/${day}.${fileExt}`;

      // Upload to storage with upsert to replace existing
      const { error: uploadError } = await supabase.storage
        .from("siwes-evidence")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("siwes-evidence")
        .getPublicUrl(filePath);

      // Insert or update in database
      const { data: existing } = await supabase
        .from("student_evidence_uploads")
        .select("id")
        .eq("student_id", studentId)
        .eq("week_number", weekNumber)
        .eq("day", day)
        .maybeSingle();

      if (existing) {
        // Update existing record
        const { error: updateError } = await supabase
          .from("student_evidence_uploads")
          .update({ image_url: publicUrl })
          .eq("id", existing.id);

        if (updateError) throw updateError;
      } else {
        // Insert new record
        const { error: insertError } = await supabase
          .from("student_evidence_uploads")
          .insert({
            student_id: studentId,
            week_number: weekNumber,
            day,
            image_url: publicUrl,
          });

        if (insertError) throw insertError;
      }

      toast.success(`${day} photo uploaded successfully`);
      fetchUploads();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to upload photo";
      toast.error(errorMessage);
      console.error(error);
    } finally {
      setUploading({ ...uploading, [day]: false });
    }
  };

  const handleDelete = async (day: string, upload: EvidenceUpload) => {
    try {
      // Extract file path from URL
      const urlParts = upload.image_url.split("/siwes-evidence/");
      const filePath = urlParts.length > 1 ? urlParts[1] : null;

      if (filePath) {
        // Delete from storage
        const { error: storageError } = await supabase.storage
          .from("siwes-evidence")
          .remove([filePath]);

        if (storageError) console.error("Storage delete error:", storageError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from("student_evidence_uploads")
        .delete()
        .eq("id", upload.id);

      if (dbError) throw dbError;
      toast.success(`${day} photo deleted`);
      fetchUploads();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete photo";
      toast.error(errorMessage);
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Weekly Evidence Photos</h3>
        <p className="text-sm text-muted-foreground">Week {weekNumber}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {DAYS_OF_WEEK.map((day, index) => {
          const upload = uploads[day];
          const isUploading = uploading[day];

          return (
            <SlideUp key={day} delay={index * 0.05}>
              <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center justify-between">
                    <span>{day}</span>
                    {upload && (
                      <AnimatedIcon
                        Icon={Calendar}
                        size={16}
                        className="text-muted-foreground"
                      />
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {upload ? (
                    <>
                      <div className="relative group">
                        <img
                          src={upload.image_url}
                          alt={`${day} evidence`}
                          className="w-full h-32 object-cover rounded-md"
                        />
                        <Button
                          size="icon"
                          variant="destructive"
                          className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleDelete(day, upload)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <p>Uploaded: {format(new Date(upload.created_at), "MMM dd, yyyy 'at' h:mm a")}</p>
                      </div>
                      <label className="block">
                        <Input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png"
                          data-day={day}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(day, file);
                            // Reset input value to allow re-uploading same file
                            e.target.value = "";
                          }}
                          disabled={isUploading}
                          className="hidden"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          disabled={isUploading}
                          onClick={(e) => {
                            e.preventDefault();
                            const input = document.querySelector(
                              `input[type="file"][data-day="${day}"]`
                            ) as HTMLInputElement;
                            input?.click();
                          }}
                        >
                          <Upload className="h-3 w-3 mr-2" />
                          {isUploading ? "Uploading..." : "Replace Photo"}
                        </Button>
                      </label>
                    </>
                  ) : (
                    <>
                      <div className="w-full h-32 border-2 border-dashed border-muted-foreground/30 rounded-md flex items-center justify-center bg-muted/20">
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <label className="block">
                        <Input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png"
                          data-day={day}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(day, file);
                            // Reset input value to allow re-uploading same file
                            e.target.value = "";
                          }}
                          disabled={isUploading}
                          className="hidden"
                        />
                        <Button
                          variant="default"
                          size="sm"
                          className="w-full"
                          disabled={isUploading}
                          onClick={(e) => {
                            e.preventDefault();
                            const input = document.querySelector(
                              `input[type="file"][data-day="${day}"]`
                            ) as HTMLInputElement;
                            input?.click();
                          }}
                        >
                          <Upload className="h-3 w-3 mr-2" />
                          {isUploading ? "Uploading..." : "Upload Photo"}
                        </Button>
                      </label>
                    </>
                  )}
                </CardContent>
              </Card>
            </SlideUp>
          );
        })}
      </div>

      <CardDescription className="text-sm text-muted-foreground text-center">
        Upload daily pictures as evidence of your SIWES activities. Maximum file size: 5MB. Formats: JPG, PNG.
      </CardDescription>
    </div>
  );
};

