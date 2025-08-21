import { Settings, User, Globe, Mail, CheckCircle } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OptimizedAvatar } from "@/components/OptimizedAvatar";
import { OptimizedProfileHeader } from "@/components/OptimizedProfileHeader";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { genUserName } from "@/lib/genUserName";
import { UserImageGrid } from "./UserImageGrid";
import { UserVideoGrid } from "./UserVideoGrid";

interface UserProfileViewProps {
  onEditClick?: () => void;
}

export function UserProfileView({ onEditClick }: UserProfileViewProps) {
  const { user, metadata, isLoading: profileLoading } = useCurrentUser();

  if (!user) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 px-8 text-center">
          <div className="max-w-sm mx-auto space-y-6">
            <User className="h-12 w-12 text-muted-foreground mx-auto" />
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Login Required</h3>
              <p className="text-muted-foreground">
                Please log in to view your profile
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Optimized Profile Header */}
      <OptimizedProfileHeader
        user={user}
        metadata={metadata}
        onEditClick={onEditClick}
        isLoading={profileLoading}
      />

      {/* Content Tabs */}
      <Tabs defaultValue="pix" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pix">Pix</TabsTrigger>
          <TabsTrigger value="flix">Flix</TabsTrigger>
        </TabsList>

        <TabsContent value="pix" className="mt-6">
          <UserImageGrid pubkey={user.pubkey} />
        </TabsContent>

        <TabsContent value="flix" className="mt-6">
          <UserVideoGrid pubkey={user.pubkey} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
