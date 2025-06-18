import { useParams, useNavigate } from "react-router-dom";
import { useSeoMeta } from "@unhead/react";
import { nip19 } from "nostr-tools";
import { useQuery } from "@tanstack/react-query";
import { useNostr } from "@nostrify/react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ImagePost } from "@/components/ImagePost";
import { VideoPost } from "@/components/VideoPost";
import { ImagePostSkeleton } from "@/components/ImagePostSkeleton";
import { MainLayout } from "@/components/MainLayout";
import { PublicUserProfilePage } from "@/components/PublicUserProfilePage";
import NotFound from "./NotFound";

const PostPage = () => {
  const params = useParams();
  const nip19Id = params.nip19;
  const navigate = useNavigate();
  const { nostr } = useNostr();

  const handleLocationClick = (location: string) => {
    navigate(`/location/${encodeURIComponent(location)}`, {
      state: { from: "home" },
    });
  };

  // Default SEO meta - will be overridden for specific content types
  useSeoMeta({
    title: "Zappix",
    description: "View content on Zappix",
  });

  const decodedQuery = useQuery({
    queryKey: ["decoded", nip19Id],
    queryFn: async () => {
      if (!nip19Id) throw new Error("No ID provided");

      // Check if it looks like a NIP-19 identifier
      if (!nip19Id.match(/^(npub|nprofile|note|nevent|naddr)1[a-z0-9]+$/)) {
        throw new Error("Not a valid NIP-19 identifier");
      }

      try {
        const decoded = nip19.decode(nip19Id);
        return decoded;
      } catch {
        throw new Error("Failed to decode NIP-19 identifier");
      }
    },
    enabled: !!nip19Id,
  });

  const postQuery = useQuery({
    queryKey: ["post", nip19Id],
    queryFn: async (c) => {
      if (!decodedQuery.data) {
        return null;
      }

      let eventId: string;
      
      // Handle different event identifier types
      if (decodedQuery.data.type === "nevent") {
        eventId = decodedQuery.data.data.id;
      } else if (decodedQuery.data.type === "note") {
        eventId = decodedQuery.data.data;
      } else if (decodedQuery.data.type === "naddr") {
        // For addressable events, we need to query by kind, author, and d-tag
        const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
        const events = await nostr.query(
          [
            {
              kinds: [decodedQuery.data.data.kind],
              authors: [decodedQuery.data.data.pubkey],
              "#d": [decodedQuery.data.data.identifier],
              limit: 1,
            },
          ],
          { signal }
        );
        return events[0] || null;
      } else {
        return null;
      }

      // For regular events (note, nevent), query by ID
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const events = await nostr.query(
        [
          {
            ids: [eventId],
            kinds: [20, 21, 22], // Support image and both video kinds
            limit: 1,
          },
        ],
        { signal }
      );

      return events[0] || null;
    },
    enabled: !!decodedQuery.data && ["nevent", "note", "naddr"].includes(decodedQuery.data.type),
  });



  // If the query failed because it's not a valid NIP-19 identifier, show 404
  if (decodedQuery.error && decodedQuery.error.message === "Not a valid NIP-19 identifier") {
    return <NotFound />;
  }

  // Handle different identifier types after all hooks are called
  if (decodedQuery.data) {
    // If this is a profile identifier, render the profile page
    if (["npub", "nprofile"].includes(decodedQuery.data.type)) {
      let pubkey: string;
      if (decodedQuery.data.type === "npub") {
        pubkey = decodedQuery.data.data as string;
      } else if (decodedQuery.data.type === "nprofile") {
        const profileData = decodedQuery.data.data as { pubkey: string };
        pubkey = profileData.pubkey;
      } else {
        pubkey = "";
      }
      return <PublicUserProfilePage pubkey={pubkey} />;
    }

    // If this is not an event identifier, show error
    if (!["nevent", "note", "naddr"].includes(decodedQuery.data.type)) {
      return (
        <MainLayout>
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center space-x-4">
              <Button variant="outline" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </div>
            <Card className="border-dashed">
              <CardContent className="py-12 px-8 text-center">
                <div className="max-w-sm mx-auto space-y-6">
                  <p className="text-muted-foreground">
                    Unsupported NIP-19 identifier type: {decodedQuery.data.type}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </MainLayout>
      );
    }
  }

  const content = (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      {postQuery.isLoading ? (
        <ImagePostSkeleton />
      ) : postQuery.error || !postQuery.data ? (
        <Card className="border-dashed">
          <CardContent className="py-12 px-8 text-center">
            <div className="max-w-sm mx-auto space-y-6">
              <p className="text-muted-foreground">
                Post not found. It may have been deleted or the ID is invalid.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        [21, 22].includes(postQuery.data.kind) ? (
          <VideoPost
            event={postQuery.data}
            onHashtagClick={(hashtag) => navigate(`/hashtag/${hashtag}`)}
            onLocationClick={handleLocationClick}
          />
        ) : (
          <ImagePost
            event={postQuery.data}
            onHashtagClick={(hashtag) => navigate(`/hashtag/${hashtag}`)}
            onLocationClick={handleLocationClick}
          />
        )
      )}
    </div>
  );

  return <MainLayout key="post-layout">{content}</MainLayout>;
};

export default PostPage;
