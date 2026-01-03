import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Upload, Image as ImageIcon } from "lucide-react";
import { Card } from "./ui/card";

interface Photo {
  id: string;
  image_url: string;
  description: string | null;
}

interface PhotoUploadProps {
  weekId: string;
  day: string;
  photos: Photo[];
  onPhotosChange: () => void;
  disabled?: boolean;
}

export const PhotoUpload = ({ weekId, day, photos, onPhotosChange, disabled }: PhotoUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState("");

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (photos.length >= 5) {
      toast.error("Maximum 5 photos per day");
      return;
    }

    // Validate file size (3MB max)
    if (file.size > 3 * 1024 * 1024) {
      toast.error("File size must be less than 3MB");
      return;
    }

    // Validate file type (JPG/PNG only)
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      toast.error("Only JPG and PNG files are allowed");
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${weekId}/${day}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("student-photos")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("student-photos")
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from("photos")
        .insert({
          week_id: weekId,
          day_of_week: day,
          image_url: publicUrl,
          description: description || null,
        });

      if (dbError) throw dbError;

      toast.success("Photo uploaded successfully");
      setDescription("");
      onPhotosChange();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to upload photo";
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (photoId: string, imageUrl: string) => {
    try {
      const fileName = imageUrl.split("/student-photos/")[1];
      
      await supabase.storage.from("student-photos").remove([fileName]);
      
      const { error } = await supabase
        .from("photos")
        .delete()
        .eq("id", photoId);

      if (error) throw error;

      toast.success("Photo deleted");
      onPhotosChange();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete photo";
      toast.error(errorMessage);
    }
  };

  return (
    <div className="space-y-4">
      {!disabled && photos.length < 5 && (
        <Card className="p-4 bg-muted/30">
          <div className="space-y-3">
            <Label htmlFor={`photo-${day}`} className="text-sm font-medium">
              Add Photo (Max 5, JPG/PNG only, 3MB max)
            </Label>
            <Textarea
              placeholder="Describe what you did (optional)..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="resize-none"
            />
            <div className="flex items-center gap-2">
              <Input
                id={`photo-${day}`}
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={handleFileUpload}
                disabled={uploading}
                className="flex-1"
              />
              <Button
                type="button"
                size="sm"
                disabled={uploading}
                onClick={() => document.getElementById(`photo-${day}`)?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? "Uploading..." : "Upload"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {photos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {photos.map((photo) => (
            <Card key={photo.id} className="relative group overflow-hidden">
              <img
                src={photo.image_url}
                alt={photo.description || "Activity photo"}
                className="w-full h-32 object-cover"
              />
              {!disabled && (
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleDelete(photo.id, photo.image_url)}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
              {photo.description && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2">
                  {photo.description}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {photos.length === 0 && disabled && (
        <div className="text-center py-4 text-muted-foreground text-sm flex items-center justify-center gap-2">
          <ImageIcon className="h-4 w-4" />
          No photos uploaded for this day
        </div>
      )}
    </div>
  );
};
