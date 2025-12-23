import { memo } from "react";
import { Image as ImageIcon, Video } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PostTypeSelectorProps {
  postType: "image" | "video";
  onPostTypeChange: (type: "image" | "video") => void;
}

export const PostTypeSelector = memo(function PostTypeSelector({
  postType,
  onPostTypeChange,
}: PostTypeSelectorProps) {
  return (
    <div className="space-y-2">
      <Label>Create</Label>
      <Tabs
        value={postType}
        onValueChange={(value) => onPostTypeChange(value as "image" | "video")}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="image" className="flex items-center space-x-2">
            <ImageIcon className="h-4 w-4" />
            <span>Pix</span>
          </TabsTrigger>
          <TabsTrigger value="video" className="flex items-center space-x-2">
            <Video className="h-4 w-4" />
            <span>Flix</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
});
