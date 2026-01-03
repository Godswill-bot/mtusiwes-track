import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Upload, Image as ImageIcon } from "lucide-react";
import { Card } from "./ui/card";

interface WeeklyReportImageUploadProps {
  weekId: string;
  studentId: string;
  currentImages: string[];
  onImagesChange: (images: string[]) => void;
  disabled?: boolean;
}

export const WeeklyReportImageUpload = ({
  weekId,
  studentId,
  currentImages,
  onImagesChange,
  disabled,
}: WeeklyReportImageUploadProps) => {
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (currentImages.length + files.length > 10) {
      toast.error("Maximum 10 images per weekly report");
      return;
    }

    setUploading(true);
    const uploadedUrls: string[] = [];

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      for (const file of Array.from(files)) {
        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} is too large. Maximum size is 5MB`);
          continue;
        }

        // Validate file type
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type.toLowerCase())) {
          toast.error(`${file.name} is not a valid image format`);
          continue;
        }

        const fileExt = file.name.split(".").pop();
        const fileName = `${user.id}/${weekId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("weekly-reports")
          .upload(fileName, file);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from("weekly-reports")
          .getPublicUrl(fileName);

        uploadedUrls.push(publicUrl);
      }

      if (uploadedUrls.length > 0) {
        const newImages = [...currentImages, ...uploadedUrls];
        onImagesChange(newImages);
        toast.success(`${uploadedUrls.length} image(s) uploaded successfully`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to upload images";
      toast.error(errorMessage);
    } finally {
      setUploading(false);
      // Reset input
      event.target.value = '';
    }
  };

  const handleDelete = async (imageUrl: string) => {
    try {
      // Extract file path from URL
      const urlParts = imageUrl.split('/weekly-reports/');
      if (urlParts.length < 2) {
        toast.error("Invalid image URL");
        return;
      }

      const fileName = urlParts[1].split('?')[0]; // Remove query params
      
      const { error } = await supabase.storage
        .from("weekly-reports")
        .remove([fileName]);

      if (error) throw error;

      const newImages = currentImages.filter(url => url !== imageUrl);
      onImagesChange(newImages);
      toast.success("Image deleted");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete image";
      toast.error(errorMessage);
    }
  };

  return (
    <div className="space-y-4">
      {!disabled && currentImages.length < 10 && (
        <Card className="p-4 bg-muted/30">
          <div className="space-y-3">
            <Label htmlFor={`weekly-images-${weekId}`} className="text-sm font-medium">
              Upload Images (Max 10, JPG/PNG/WEBP, 5MB max each)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id={`weekly-images-${weekId}`}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleFileUpload}
                disabled={uploading}
                multiple
                className="flex-1"
              />
              <Button
                type="button"
                size="sm"
                disabled={uploading}
                onClick={() => document.getElementById(`weekly-images-${weekId}`)?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? "Uploading..." : "Upload"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {currentImages.length}/10 images uploaded
            </p>
          </div>
        </Card>
      )}

      {currentImages.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {currentImages.map((imageUrl, index) => (
            <Card key={index} className="relative group overflow-hidden">
              <img
                src={imageUrl}
                alt={`Weekly report image ${index + 1}`}
                className="w-full h-32 object-cover"
              />
              {!disabled && (
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleDelete(imageUrl)}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      {currentImages.length === 0 && disabled && (
        <div className="text-center py-4 text-muted-foreground text-sm flex items-center justify-center gap-2">
          <ImageIcon className="h-4 w-4" />
          No images uploaded for this week
        </div>
      )}
    </div>
  );
};

