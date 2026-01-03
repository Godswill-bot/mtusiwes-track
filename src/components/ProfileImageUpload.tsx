/**
 * Profile Image Upload Component
 * Allows students to upload their profile picture to Supabase Storage
 */

import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Camera, Loader2, X, Upload } from "lucide-react";

interface ProfileImageUploadProps {
  userId: string;
  currentImageUrl?: string | null;
  fullName?: string;
  onUploadComplete: (url: string) => void;
  size?: "sm" | "md" | "lg";
}

const BUCKET_NAME = "profile_pictures";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export const ProfileImageUpload = ({
  userId,
  currentImageUrl,
  fullName = "Student",
  onUploadComplete,
  size = "md"
}: ProfileImageUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Size configurations
  const sizeClasses = {
    sm: "h-16 w-16",
    md: "h-24 w-24",
    lg: "h-32 w-32"
  };

  // Get initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(part => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Handle file selection
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Invalid file type. Please upload a JPG, PNG, or WebP image.");
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File too large. Maximum size is 5MB.");
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    await uploadFile(file);
  };

  // Upload file to Supabase Storage
  const uploadFile = async (file: File) => {
    setUploading(true);

    try {
      // Generate unique filename
      const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const fileName = `${userId}/${Date.now()}.${fileExt}`;

      // Delete old image if exists (optional cleanup)
      if (currentImageUrl) {
        try {
          const oldPath = currentImageUrl.split(`${BUCKET_NAME}/`)[1];
          if (oldPath) {
            await supabase.storage.from(BUCKET_NAME).remove([oldPath]);
          }
        } catch (e) {
          console.log("Could not delete old image:", e);
        }
      }

      // Upload new image
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(fileName);

      // Call callback with new URL
      onUploadComplete(publicUrl);
      toast.success("Profile picture uploaded successfully!");
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Failed to upload profile picture. Please try again.");
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };

  // Clear preview
  const clearPreview = () => {
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Trigger file input
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const displayUrl = previewUrl || currentImageUrl;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
        aria-label="Upload profile picture"
        title="Select profile picture to upload"
      />

      {/* Avatar with upload overlay */}
      <div className="relative group">
        <Avatar className={`${sizeClasses[size]} border-4 border-background shadow-lg`}>
          <AvatarImage 
            src={displayUrl || undefined} 
            alt={fullName}
            className="object-cover"
          />
          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
            {getInitials(fullName)}
          </AvatarFallback>
        </Avatar>

        {/* Upload overlay */}
        <button
          onClick={triggerFileInput}
          disabled={uploading}
          className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          aria-label={uploading ? "Uploading profile picture" : "Click to upload profile picture"}
          title={uploading ? "Uploading..." : "Upload profile picture"}
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 text-white animate-spin" />
          ) : (
            <Camera className="h-6 w-6 text-white" />
          )}
        </button>

        {/* Clear button when preview exists */}
        {previewUrl && !uploading && (
          <button
            onClick={clearPreview}
            className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-1 shadow-md hover:bg-destructive/90"
            aria-label="Remove selected image"
            title="Remove selected image"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Upload button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={triggerFileInput}
        disabled={uploading}
        className="gap-2"
      >
        {uploading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            {currentImageUrl ? "Change Photo" : "Upload Photo"}
          </>
        )}
      </Button>

      {/* Help text */}
      <p className="text-xs text-muted-foreground text-center">
        JPG, PNG or WebP. Max 5MB.
      </p>
    </div>
  );
};

export default ProfileImageUpload;
