import { memo } from "react";
import { Video } from "lucide-react";
import { Label } from "@/components/ui/label";

export const VideoRequirements = memo(function VideoRequirements() {
  return (
    <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
      <div className="flex items-center space-x-2">
        <Video className="h-5 w-5 text-primary" />
        <Label className="font-medium">Video Requirements</Label>
      </div>
      <div className="space-y-2 text-sm text-muted-foreground">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-primary rounded-full" />
          <span>Must be vertical/portrait orientation (height &gt; width)</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-primary rounded-full" />
          <span>Maximum duration: 3 minutes</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-primary rounded-full" />
          <span>Supported formats: MP4, WebM, MOV</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          <span>Memory-safe compression for mobile optimization</span>
        </div>
      </div>
    </div>
  );
});
