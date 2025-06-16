import { useParams, useNavigate } from "react-router-dom";
import { useSeoMeta } from "@unhead/react";
import { nip19 } from "nostr-tools";
import { useQuery } from "@tanstack/react-query";
import { useNostr } from "@nostrify/react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ImagePost } from "@/components/ImagePost";
import { ImagePostSkeleton } from "@/components/ImagePostSkeleton";
import { MainLayout } from "@/components/MainLayout";

const PostPage = () => {
  const { nip19Id } = useParams<{ nip19Id: string }>();
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

      try {
        const decoded = nip19.decode(nip19Id);
        return decoded;
      } catch {
        throw new Error("Failed to decode identifier");
      }
    },
    enabled: !!nip19Id,
  });

  const postQuery = useQuery({
    queryKey: ["post", nip19Id],
    queryFn: async (c) => {
      if (!decodedQuery.data || decodedQuery.data.type !== "nevent") {
        return null;
      }

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const events = await nostr.query(
        [
          {
            ids: [decodedQuery.data.data.id],
            kinds: [20],
            limit: 1,
          },
        ],
        { signal }
      );

      return events[0] || null;
    },
    enabled: !!decodedQuery.data && decodedQuery.data.type === "nevent",
  });

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
        <ImagePost
          event={postQuery.data}
          onHashtagClick={(hashtag) => navigate(`/hashtag/${hashtag}`)}
          onLocationClick={handleLocationClick}
        />
      )}
    </div>
  );

  return <MainLayout>{content}</MainLayout>;
};

export default PostPage;
