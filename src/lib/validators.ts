import type { NostrEvent } from "@nostrify/nostrify";

/**
 * Validator function for vertical video events
 * Supports NIP-71 kinds 22 & 34236, plus OpenVine kind 32222
 */
export function validateVideoEvent(event: NostrEvent): boolean {
  // Check for OpenVine video events (kind 32222)
  if (event.kind === 32222) {
    const imetaTags = event.tags.filter(([name]) => name === "imeta");

    const hasVideoImeta = imetaTags.some(tag => {
      const tagContent = tag.slice(1).join(" ");
      const hasUrl = tagContent.includes("url ") || /url\s+\S+/.test(tagContent);
      const hasVideoMime = tagContent.includes("m video/") || /m\s+video\//.test(tagContent);
      return hasUrl && hasVideoMime;
    });

    if (hasVideoImeta) return true;

    const hasVideoUrl = event.tags.some(([name, value]) => {
      if (name !== 'url') return false;
      if (!value) return false;
      return /\.(mp4|webm|mov|avi|mkv|3gp|m4v)$/i.test(value) ||
             value.includes('video');
    });

    return hasVideoUrl;
  }

  // Check for NIP-71 short-form video events (kind 22)
  if (event.kind === 22) {
    const imetaTags = event.tags.filter(([name]) => name === "imeta");

    const hasVideoImeta = imetaTags.some(tag => {
      let hasUrl = false;
      let hasVideoMime = false;

      const tagContent = tag.slice(1).join(" ");

      const urlMatch = tagContent.match(/(?:^|\s)url\s+(\S+)/);
      hasUrl = !!urlMatch;

      const mimeMatch = tagContent.match(/(?:^|\s)m\s+(video\/\S+|application\/x-mpegURL)/);
      hasVideoMime = !!mimeMatch;

      if (hasUrl && !hasVideoMime) {
        const url = urlMatch![1];
        hasVideoMime = /\.(mp4|webm|mov|avi|mkv|3gp|m4v)$/i.test(url);
      }

      return hasUrl && hasVideoMime;
    });

    const hasVideoUrl = event.tags.some(([name, value]) => {
      if (name !== 'url') return false;
      if (!value) return false;
      return /\.(mp4|webm|mov|avi|mkv|3gp|m4v)$/i.test(value) ||
             value.includes('video') ||
             value.includes('.webm') ||
             value.includes('.mp4');
    });

    const hasSingleStringImeta = event.tags.some(([name, value]) => {
      if (name !== 'imeta' || !value) return false;

      const hasUrl = value.includes('url https://') || value.includes('url http://');
      const hasVideoMime = value.includes('m video/') || value.includes('m application/x-mpegURL');
      const hasVideoExtension = /\.(mp4|webm|mov|avi|mkv|3gp|m4v)/i.test(value);

      return hasUrl && (hasVideoMime || hasVideoExtension);
    });

    return hasVideoImeta || hasSingleStringImeta || hasVideoUrl;
  }

  // Check for NIP-71 addressable short video events (kind 34236)
  if (event.kind === 34236) {
    const imetaTags = event.tags.filter(([name]) => name === "imeta");

    const hasVideoImeta = imetaTags.some(tag => {
      const tagContent = tag.slice(1).join(" ");

      const hasUrlPrefix = tagContent.includes("url ") || /url\s+\S+/.test(tagContent);
      const hasHttpUrl = tagContent.includes("http://") || tagContent.includes("https://");
      const hasUrl = hasUrlPrefix || hasHttpUrl;

      const hasMimePrefix = tagContent.includes("m video/") || /m\s+video\//.test(tagContent);
      const hasVideoMime = hasMimePrefix || tagContent.includes("video/");

      return hasUrl && hasVideoMime;
    });

    const hasMimeTag = event.tags.some(([name, value]) => name === "m" && value?.startsWith("video/"));
    const hasHashTag = event.tags.some(([name]) => name === "x");

    const hasVideoUrl = event.tags.some(([name, value]) => {
      if (name !== 'url') return false;
      if (!value) return false;
      return /\.(mp4|webm|mov|avi|mkv|3gp|m4v)$/i.test(value) ||
             value.includes('video');
    });

    return hasVideoImeta || (hasMimeTag && hasHashTag) || hasVideoUrl;
  }

  return false;
}

/**
 * Validator function for NIP-68 image events
 */
export function validateImageEvent(event: NostrEvent): boolean {
  if (event.kind !== 20) return false;

  const title = event.tags.find(([name]) => name === "title")?.[1];
  const imeta = event.tags.find(([name]) => name === "imeta");

  if (!title && !imeta) {
    return false;
  }

  if (imeta && imeta[1] && !imeta[1].includes("url")) {
    return false;
  }

  return true;
}
