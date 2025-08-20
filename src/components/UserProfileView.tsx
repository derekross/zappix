import { Settings, User, Globe, Mail, CheckCircle } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { genUserName } from "@/lib/genUserName";
import { UserImageGrid } from "./UserImageGrid";
import { UserVideoGrid } from "./UserVideoGrid";

interface UserProfileViewProps {
  onEditClick?: () => void;
}

export function UserProfileView({ onEditClick }: UserProfileViewProps) {
  const { user, metadata } = useCurrentUser();

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

  const displayName = metadata?.name ?? genUserName(user.pubkey);
  const profileImage = metadata?.picture;
  const bannerImage = metadata?.banner;

  return (
    <div className="space-y-6">
      {/* Header with Edit Button */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold flex items-center space-x-2">
            <User className="h-6 w-6" />
            <span>Your Profile</span>
          </h2>
        </div>
        {onEditClick && (
          <Button
            onClick={onEditClick}
            variant="outline"
            size="sm"
            className="flex items-center space-x-2"
          >
            <Settings className="h-4 w-4" />
            <span>Edit Profile</span>
          </Button>
        )}
      </div>

      {/* Profile Card */}
      <Card>
        {/* Banner */}
        {bannerImage && (
          <div className="h-32 md:h-48 overflow-hidden rounded-t-lg">
            <img
              src={bannerImage}
              alt="Profile banner"
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <CardHeader className="relative">
          {/* Avatar */}
          <div
            className={`flex items-start space-x-4 ${
              bannerImage ? "-mt-16" : ""
            }`}
          >
            <Avatar
              className={`w-20 h-20 md:w-24 md:h-24 border-4 border-background ${
                bannerImage ? "relative z-10" : ""
              }`}
            >
              <AvatarImage src={profileImage} alt={displayName} />
              <AvatarFallback className="text-lg md:text-xl">
                {displayName.charAt(0)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 space-y-2 pt-2">
              <div className="space-y-1">
                <h3 className="text-xl md:text-2xl font-bold">{displayName}</h3>
                {metadata?.display_name &&
                  metadata.display_name !== metadata.name && (
                    <p className="text-muted-foreground">@{metadata.name}</p>
                  )}
              </div>

              {/* NIP-05 Verification */}
              {metadata?.nip05 && (
                <div className="flex items-center space-x-1">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-muted-foreground">
                    {metadata.nip05}
                  </span>
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Bio */}
          {metadata?.about && (
            <div className="space-y-2">
              <h4 className="font-medium">About</h4>
              <p className="text-muted-foreground whitespace-pre-wrap break-words">
                {metadata.about}
              </p>
            </div>
          )}

          {/* Website */}
          {metadata?.website && (
            <div className="space-y-2">
              <h4 className="font-medium">Website</h4>
              <a
                href={metadata.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 text-primary hover:underline"
              >
                <Globe className="h-4 w-4" />
                <span className="break-all">{metadata.website}</span>
              </a>
            </div>
          )}

          {/* Lightning Address */}
          {(metadata?.lud16 || metadata?.lud06) && (
            <div className="space-y-2">
              <h4 className="font-medium">Lightning Address</h4>
              <div className="flex items-center space-x-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span className="break-all font-mono text-sm">
                  {metadata.lud16 || metadata.lud06}
                </span>
              </div>
            </div>
          )}

          {/* Bot Badge */}
          {metadata?.bot && (
            <div className="flex items-center space-x-2">
              <Badge variant="secondary">🤖 Bot Account</Badge>
            </div>
          )}
        </CardContent>
      </Card>

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
