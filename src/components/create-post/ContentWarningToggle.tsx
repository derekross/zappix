import { memo } from "react";
import { AlertTriangle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

interface ContentWarningToggleProps {
  hasContentWarning: boolean;
  contentWarning: string;
  onHasContentWarningChange: (value: boolean) => void;
  onContentWarningChange: (value: string) => void;
}

export const ContentWarningToggle = memo(function ContentWarningToggle({
  hasContentWarning,
  contentWarning,
  onHasContentWarningChange,
  onContentWarningChange,
}: ContentWarningToggleProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center space-x-2">
        <Switch
          id="content-warning"
          checked={hasContentWarning}
          onCheckedChange={onHasContentWarningChange}
        />
        <Label htmlFor="content-warning" className="flex items-center space-x-2">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          <span>Content Warning</span>
        </Label>
      </div>

      {hasContentWarning && (
        <Input
          placeholder="Describe the sensitive content..."
          value={contentWarning}
          onChange={(e) => onContentWarningChange(e.target.value)}
        />
      )}
    </div>
  );
});
