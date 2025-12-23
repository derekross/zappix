import { memo } from "react";
import { Progress } from "@/components/ui/progress";

interface UploadProgressProps {
  progress: number;
  currentFileName: string;
  postType: "image" | "video";
}

export const UploadProgress = memo(function UploadProgress({
  progress,
  currentFileName,
  postType,
}: UploadProgressProps) {
  const truncatedFileName = currentFileName.length > 20
    ? currentFileName.substring(0, 20) + '...'
    : currentFileName;

  const getProgressMessage = () => {
    if (progress === 0) {
      return postType === "video"
        ? "Analyzing video for compression..."
        : "Preparing files for upload...";
    }
    if (progress < 25) {
      return postType === "video"
        ? "Compressing video for mobile optimization..."
        : `Starting upload of "${truncatedFileName}"...`;
    }
    if (progress < 50) {
      return postType === "video"
        ? `Compressing video... ${progress}% complete`
        : `Uploading "${truncatedFileName}"...`;
    }
    if (progress < 90) {
      return postType === "video"
        ? "Uploading compressed video... Faster on mobile!"
        : `Uploading "${truncatedFileName}"...`;
    }
    if (progress < 100) {
      return "Processing metadata and finalizing upload...";
    }
    return "Upload complete! Processing metadata...";
  };

  return (
    <div className="space-y-3 p-4 bg-primary/5 border border-primary/20 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between min-w-0">
        <div className="flex items-center space-x-2 min-w-0 flex-1">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent flex-shrink-0" />
          <span className="text-sm font-medium truncate">
            {postType === "video" ? "Processing video..." : "Uploading images..."}
          </span>
        </div>
        <span className="text-sm text-muted-foreground flex-shrink-0 ml-2">
          {Math.round(progress)}%
        </span>
      </div>
      <Progress value={progress} className="w-full h-2" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground text-center break-words">
          {getProgressMessage()}
        </p>
      </div>
    </div>
  );
});
