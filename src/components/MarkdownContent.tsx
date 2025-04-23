// src/components/MarkdownContent.tsx
import React, { useState, useEffect } from "react"; // Added hooks
import ReactMarkdown, { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link, Typography, Skeleton, Tooltip } from "@mui/material"; // Added Skeleton, Tooltip
import { Link as RouterLink } from "react-router-dom"; // v6
import { nip19 } from "nostr-tools"; // Import nip19
import { NDKUserProfile, NDKSubscriptionCacheUsage } from "@nostr-dev-kit/ndk"; // Import NDK types
import { useNdk } from "../contexts/NdkContext"; // Import useNdk hook

interface MarkdownContentProps {
  content: string;
}

// --- Component to render NIP-19 mentions ---
interface NostrMentionProps {
  uri: string;
}

const NostrMention: React.FC<NostrMentionProps> = ({ uri }) => {
  const { ndk } = useNdk();
  const [profile, setProfile] = useState<NDKUserProfile | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [npub, setNpub] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isValidNostrUri, setIsValidNostrUri] = useState<boolean>(false);
  const [targetPath, setTargetPath] = useState<string>("#"); // Default/fallback path

  useEffect(() => {
    let decodedType = "";
    let decodedData: string | object = ""; // Can be string (pubkey/id) or object (nprofile/nevent)

    try {
      // Remove "nostr:" prefix if present
      const bareUri = uri.startsWith("nostr:") ? uri.substring(6) : uri;
      const decodedResult = nip19.decode(bareUri);
      decodedType = decodedResult.type;
      decodedData = decodedResult.data;
      setIsValidNostrUri(true);

      if (decodedType === "npub" && typeof decodedData === "string") {
        setNpub(bareUri); // Store original npub for link
        setTargetPath(`/profile/${bareUri}`);
        setDisplayName(bareUri.substring(0, 10) + "..."); // Default display
        setIsLoading(true);
        ndk
          ?.getUser({ pubkey: decodedData })
          .fetchProfile({ cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST })
          .then((p) => {
            setProfile(p);
            setDisplayName(
              p?.displayName || p?.name || bareUri.substring(0, 10) + "..."
            );
          })
          .catch((e) =>
            console.error(`Failed to fetch profile for ${bareUri}`, e)
          )
          .finally(() => setIsLoading(false));
      } else if (
        decodedType === "nprofile" &&
        typeof decodedData === "object" &&
        "pubkey" in decodedData
      ) {
        const nprofileData = decodedData as nip19.ProfilePointer;
        const profileNpub = nip19.npubEncode(nprofileData.pubkey);
        setNpub(profileNpub);
        setTargetPath(`/profile/${profileNpub}`);
        setDisplayName(profileNpub.substring(0, 10) + "...");
        setIsLoading(true);
        ndk
          ?.getUser({ pubkey: nprofileData.pubkey })
          .fetchProfile({ cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST })
          .then((p) => {
            setProfile(p);
            setDisplayName(
              p?.displayName || p?.name || profileNpub.substring(0, 10) + "..."
            );
          })
          .catch((e) =>
            console.error(`Failed to fetch profile for ${bareUri}`, e)
          )
          .finally(() => setIsLoading(false));
      } else if (decodedType === "note") {
        setNpub(""); // No user profile to fetch for note
        setTargetPath(`/n/${bareUri}`); // Link to thread page
        setDisplayName(bareUri.substring(0, 10) + "..."); // Display truncated note ID
        setIsLoading(false);
      } else if (decodedType === "nevent") {
        const neventData = decodedData as nip19.EventPointer;
        setNpub("");
        setTargetPath(`/n/${bareUri}`);
        setDisplayName(
          nip19.noteEncode(neventData.id).substring(0, 10) + "..."
        ); // Display truncated note ID
        setIsLoading(false);
      }
      // Add more types (naddr, nrelay, etc.) if needed
      else {
        setDisplayName(bareUri); // Display unsupported type as is
        setIsValidNostrUri(false); // Treat as non-linkable for now
        setIsLoading(false);
      }
    } catch (e) {
      console.warn(`Failed to decode or process NIP-19 URI: ${uri}`, e);
      setDisplayName(uri); // Display original URI on error
      setIsValidNostrUri(false);
      setIsLoading(false);
    }
  }, [uri, ndk]); // Depend on uri and ndk instance

  if (isLoading) {
    return (
      <Skeleton
        variant="text"
        width={80}
        sx={{ display: "inline-block", ml: 0.5, mr: 0.5 }}
      />
    );
  }

  if (isValidNostrUri && targetPath !== "#") {
    // Use Tooltip to show full npub/note ID on hover
    return (
      <Tooltip title={npub || uri} placement="top">
        <Link
          component={RouterLink}
          to={targetPath}
          sx={{ fontWeight: "medium" }}
        >
          @{displayName}
        </Link>
      </Tooltip>
    );
  }

  // If not a valid/linkable nostr URI or loading failed, render the original text
  // We return the display name which might be the original URI on error
  return <>{displayName}</>;
};

// --- Main Markdown Component ---
type CustomAnchorRenderer = React.FC<
  React.AnchorHTMLAttributes<HTMLAnchorElement> & { node?: any }
>;

export const MarkdownContent: React.FC<MarkdownContentProps> = ({
  content,
}) => {
  const { ndk } = useNdk(); // NDK needed for NostrMention

  const LinkRenderer: CustomAnchorRenderer = ({
    node,
    children,
    href,
    ...props
  }) => {
    const targetHref = href || "";

    // Check for nostr: URI first
    if (targetHref.startsWith("nostr:")) {
      // Render the specialized NostrMention component
      return <NostrMention uri={targetHref} />;
    }
    // Internal app links
    else if (targetHref.startsWith("/") || targetHref.startsWith("#")) {
      if (targetHref.startsWith("#")) {
        const tag = targetHref.substring(1);
        return (
          <Link component={RouterLink} to={`/t/${tag}`}>
            {children}
          </Link>
        );
      }
      return (
        <Link component={RouterLink} to={targetHref}>
          {children}
        </Link>
      );
    }
    // External links
    else {
      return (
        <Link
          href={targetHref}
          target="_blank"
          rel="noopener noreferrer"
          title={props.title}
        >
          {children}
        </Link>
      );
    }
  };

  const markdownComponents: Components = {
    a: LinkRenderer,
    // Optional: Override other elements if needed
  };

  // Prevent rendering if NDK is not yet available, as NostrMention needs it
  if (!ndk) {
    return (
      <Typography
        component="div"
        variant="body1"
        sx={{ wordBreak: "break-word" }}
      >
        {content}
      </Typography>
    ); // Render plain text or skeleton
  }

  return (
    <Typography
      component="div"
      variant="body1"
      sx={{ wordBreak: "break-word" }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </Typography>
  );
};
