import { memo } from "react";
import { Hash } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { parseHashtags } from "@/lib/mediaUtils";

interface HashtagInputProps {
  hashtags: string;
  onHashtagsChange: (value: string) => void;
}

export const HashtagInput = memo(function HashtagInput({
  hashtags,
  onHashtagsChange,
}: HashtagInputProps) {
  const parsedTags = parseHashtags(hashtags);

  return (
    <div className="space-y-2">
      <Label htmlFor="hashtags">Hashtags</Label>
      <Input
        id="hashtags"
        placeholder="Add hashtags (comma separated)"
        value={hashtags}
        onChange={(e) => onHashtagsChange(e.target.value)}
      />
      {parsedTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {parsedTags.map((tag, index) => (
            <Badge key={index} variant="secondary" className="text-xs">
              <Hash className="h-3 w-3 mr-1" />
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
});
