import { memo } from "react";
import { Hash, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageFeed } from "@/components/ImageFeed";

interface DetailViewProps {
  type: "hashtag" | "location";
  value: string;
  backButtonText: string;
  onBack: () => void;
  onHashtagClick: (hashtag: string) => void;
  onLocationClick: (location: string) => void;
}

export const DetailView = memo(function DetailView({
  type,
  value,
  backButtonText,
  onBack,
  onHashtagClick,
  onLocationClick,
}: DetailViewProps) {
  const Icon = type === "hashtag" ? Hash : MapPin;
  const title = type === "hashtag" ? `#${value}` : value;
  const description = type === "hashtag"
    ? `Posts tagged with #${value}`
    : `Posts from ${value}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="outline" onClick={onBack}>
          {backButtonText}
        </Button>
        <div>
          <h2 className="text-2xl font-bold flex items-center space-x-2">
            <Icon className="h-6 w-6 text-primary" />
            <span>{title}</span>
          </h2>
          <p className="text-muted-foreground">{description}</p>
        </div>
      </div>
      <ImageFeed
        feedType="global"
        hashtag={type === "hashtag" ? value : undefined}
        location={type === "location" ? value : undefined}
        onHashtagClick={onHashtagClick}
        onLocationClick={onLocationClick}
        key={`${type}-${value}`}
      />
    </div>
  );
});
