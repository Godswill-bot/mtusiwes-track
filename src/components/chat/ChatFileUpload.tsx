import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export function ChatFileUpload({ conversationId, onUpload }: { conversationId: string; onUpload: (url: string, type: string) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `${conversationId}/${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage
      .from("chat_uploads")
      .upload(path, file, { upsert: false });
    if (error || !data) {
      alert("Upload failed");
      setUploading(false);
      return;
    }
    // Get public/signed URL
    const { data: urlData } = supabase.storage
      .from("chat_uploads")
      .getPublicUrl(path);
    onUpload(urlData?.publicUrl || "", file.type);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="flex items-center gap-2">
      <Input type="file" ref={fileInputRef} onChange={handleFileChange} disabled={uploading} />
      <Button disabled={uploading} onClick={() => fileInputRef.current?.click()} type="button">
        {uploading ? "Uploading..." : "Upload"}
      </Button>
    </div>
  );
}
