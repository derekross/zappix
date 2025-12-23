import { memo } from "react";
import { Globe, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageFeed } from "@/components/ImageFeed";
import { VideoFeed } from "@/components/VideoFeed";

interface FeedTabsProps {
  type: "image" | "video";
  activeTab: string;
  onActiveTabChange: (tab: string) => void;
  onHashtagClick: (hashtag: string) => void;
  onLocationClick: (location: string) => void;
}

export const FeedTabs = memo(function FeedTabs({
  type,
  activeTab,
  onActiveTabChange,
  onHashtagClick,
  onLocationClick,
}: FeedTabsProps) {
  const FeedComponent = type === "image" ? ImageFeed : VideoFeed;

  return (
    <Tabs value={activeTab} onValueChange={onActiveTabChange} className="w-full">
      <TabsList className="grid w-full grid-cols-2 mb-6">
        <TabsTrigger value="global" className="flex items-center space-x-2">
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">Global</span>
        </TabsTrigger>
        <TabsTrigger value="following" className="flex items-center space-x-2">
          <Users className="h-4 w-4" />
          <span className="hidden sm:inline">Following</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="global" className="space-y-6">
        <FeedComponent
          feedType="global"
          onHashtagClick={onHashtagClick}
          onLocationClick={onLocationClick}
        />
      </TabsContent>

      <TabsContent value="following" className="space-y-6">
        <FeedComponent
          feedType="following"
          onHashtagClick={onHashtagClick}
          onLocationClick={onLocationClick}
        />
      </TabsContent>
    </Tabs>
  );
});
