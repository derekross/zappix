import { memo } from "react";
import { X, Video } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface UploadedMedia {
  file: File;
  url: string;
  tags: string[][];
  preview: string;
  blurhash?: string;
  dimensions?: string;
  alt?: string;
  type: "image" | "video";
  duration?: number;
  thumbnail?: string;
}

interface MediaPreviewGridProps {
  media: UploadedMedia[];
  onRemove: (index: number) => void;
}

export const MediaPreviewGrid = memo(function MediaPreviewGrid({
  media,
  onRemove,
}: MediaPreviewGridProps) {
  if (media.length === 0) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {media.map((item, index) => (
        <div key={index} className="relative group">
          {item.type === "image" ? (
            <img
              src={item.preview}
              alt={`Upload ${index + 1}`}
              className="w-full aspect-square object-cover rounded-lg"
            />
          ) : (
            <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-black">
              <video
                src={item.preview}
                className="w-full h-full object-cover"
                muted
                preload="metadata"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Video className="h-8 w-8 text-white opacity-80" />
              </div>
              {item.duration && (
                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                  {Math.floor(item.duration / 60)}:
                  {Math.round(item.duration % 60)
                    .toString()
                    .padStart(2, "0")}
                </div>
              )}
            </div>
          )}
          <Button
            variant="destructive"
            size="sm"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onRemove(index)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  );
});
