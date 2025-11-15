import { useState, useRef } from "react";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Card } from "./ui/card";
import { Upload, Pen, X } from "lucide-react";
import { toast } from "sonner";

interface SignaturePadProps {
  onSignatureComplete: (file: File) => void;
  onCancel: () => void;
}

export const SignaturePad = ({ onSignatureComplete, onCancel }: SignaturePadProps) => {
  const [stampFile, setStampFile] = useState<File | null>(null);
  const [stampPreview, setStampPreview] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const handleStampUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (3MB max)
    if (file.size > 3 * 1024 * 1024) {
      toast.error("File size must be less than 3MB");
      return;
    }

    // Validate file type (PNG only for transparency)
    if (file.type !== 'image/png') {
      toast.error("Only PNG files with transparency are allowed");
      return;
    }

    setStampFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setStampPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) {
        toast.error("Failed to save signature");
        return;
      }

      const file = new File([blob], `signature-${Date.now()}.png`, { type: 'image/png' });
      onSignatureComplete(file);
    }, 'image/png');
  };

  const handleSubmitStamp = () => {
    if (!stampFile) {
      toast.error("Please upload a stamp image");
      return;
    }
    onSignatureComplete(stampFile);
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="draw" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="draw">
            <Pen className="w-4 h-4 mr-2" />
            Draw Signature
          </TabsTrigger>
          <TabsTrigger value="upload">
            <Upload className="w-4 h-4 mr-2" />
            Upload Stamp
          </TabsTrigger>
        </TabsList>

        <TabsContent value="draw" className="space-y-4">
          <Card className="p-4">
            <Label className="text-sm font-medium mb-2 block">
              Draw your signature below:
            </Label>
            <canvas
              ref={canvasRef}
              width={400}
              height={200}
              className="border border-border rounded-md w-full cursor-crosshair bg-white"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
            />
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                onClick={clearCanvas}
                size="sm"
              >
                <X className="w-4 h-4 mr-2" />
                Clear
              </Button>
              <Button
                onClick={saveSignature}
                size="sm"
                className="flex-1"
              >
                Apply Signature
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="upload" className="space-y-4">
          <Card className="p-4">
            <Label htmlFor="stamp-upload" className="text-sm font-medium mb-2 block">
              Upload Digital Stamp (PNG with transparency, max 3MB):
            </Label>
            <Input
              id="stamp-upload"
              type="file"
              accept="image/png"
              onChange={handleStampUpload}
              className="mb-4"
            />
            {stampPreview && (
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-2">Preview:</p>
                <img
                  src={stampPreview}
                  alt="Stamp preview"
                  className="max-h-32 border border-border rounded-md"
                />
              </div>
            )}
            <Button
              onClick={handleSubmitStamp}
              disabled={!stampFile}
              className="w-full"
            >
              Apply Stamp
            </Button>
          </Card>
        </TabsContent>
      </Tabs>

      <Button
        variant="outline"
        onClick={onCancel}
        className="w-full"
      >
        Cancel
      </Button>
    </div>
  );
};
