# Zappix Custom NIP

## Overview

Zappix is a social image sharing application that leverages existing Nostr NIPs for image sharing, reactions, comments, and zaps. This document outlines how Zappix implements these features using standard Nostr protocols.

## Implemented NIPs

### NIP-68 (Kind 20) - Picture Events
Zappix uses kind 20 events for image posts with the following structure:

**Required Tags:**
- `title`: Short title for the post
- `imeta`: Image metadata including URL, MIME type, dimensions, blurhash, and SHA-256 hash

**Optional Tags:**
- `t`: Hashtags for categorization and discovery
- `g`: Geohash for location data
- `location`: Named location
- `content-warning`: For sensitive content
- `p`: Tagged users

### Vertical Video Events (Kind 22 & 34236)
Zappix supports multiple kinds for vertical video content sharing:

**Kind 22 - NIP-71 Short Videos:**
- Vertical/portrait videos only (height > width)
- Short-form content similar to "stories" or "reels"
- Follows NIP-71 specification

**Kind 34236 - Additional Vertical Videos:**
- Alternative vertical video event kind
- Same vertical orientation requirements (height > width)
- Compatible with existing video infrastructure

**Required Tags for Kind 22:**
- `title`: Title of the video (required for NIP-71 compliance)
- `imeta`: Video metadata including URL, MIME type, dimensions, and optional thumbnail

**Required Tags for Kind 34236:**
- `imeta`: Video metadata including URL, MIME type, dimensions, and optional thumbnail

**Optional Tags (both kinds):**
- `title`: Title of the video (optional for kind 34236)
- `duration`: Video duration in seconds
- `alt`: Accessibility description
- `t`: Hashtags for categorization and discovery
- `g`: Geohash for location data
- `location`: Named location
- `content-warning`: For sensitive content
- `p`: Tagged users

**Video-specific imeta fields:**
- `url`: Primary video URL
- `m`: MIME type (video/mp4, video/webm, etc.)
- `dim`: Video dimensions (e.g., "1080x1920" for vertical)
- `image`: Thumbnail image URL
- `fallback`: Alternative video URLs for redundancy

**Validation Requirements:**
- Videos must be in portrait orientation (height > width)
- Horizontal videos are rejected during upload

### NIP-25 (Kind 7) - Reactions
Image and video posts support emoji reactions using kind 7 events:
- `+` or empty content for likes
- `-` for dislikes  
- Custom emoji reactions
- Required `e` tag pointing to the media post (kind 20, 22, or 34236)
- Required `p` tag pointing to the media post author

### NIP-57 (Kind 9734/9735) - Lightning Zaps
Zap support for image and video posts:
- Kind 9734: Zap requests sent to LNURL endpoints
- Kind 9735: Zap receipts published by lightning wallets
- Integration with Nostr Wallet Connect for seamless zapping

### NIP-22 (Kind 1111) - Comments
Comments on image and video posts using kind 1111:
- `E` tag pointing to the root media post (kind 20, 22, or 34236)
- `K` tag with value "20", "22", or "34236" indicating the root kind
- `P` tag pointing to the media post author
- Support for nested comment threads

### NIP-51 (Kind 10003) - Bookmarks
Bookmark functionality using the standard bookmarks list:
- Kind 10003 replaceable events
- `e` tags referencing bookmarked media posts (images and videos)
- Private bookmarks using NIP-04 encryption in content field

### NIP-65 (Kind 10002) - Relay List Metadata
Outbox model implementation:
- Kind 10002 events define user's read/write relays
- `r` tags with relay URLs and optional read/write markers
- Used for efficient event discovery and publishing

## Tag Design Principles

Zappix follows Nostr best practices for tag design:

1. **Single-letter tags for categories**: Uses `t` tags for hashtags to enable efficient relay-level filtering
2. **Relay-indexed queries**: Filters by `#t: ["hashtag"]` at the relay level rather than client-side filtering
3. **Community filtering**: Uses `t` tags to filter content relevant to specific communities

## Hashtag Categories

Zappix features predefined hashtag categories for discovery:
- `#olas` - General community content
- `#olas365` - Daily photo challenges
- `#photography` - Photography-focused content
- `#foodstr` - Food and culinary content
- `#art` - Artistic content
- `#travel` - Travel photography and stories

## Media Upload

Zappix integrates with Blossom servers (NIP-B7) for media storage:
- Kind 10063 events define user's preferred Blossom servers
- Multiple image and video uploads supported per post
- NIP-94 compatible file metadata tags
- Automatic fallback to default servers when user hasn't configured any
- Server validation and management through dedicated settings interface
- Video thumbnail generation for preview purposes
- Automatic video metadata extraction (duration, dimensions)

## Security Considerations

- Media post verification using SHA-256 hashes in `imeta` tags
- Relay hints for efficient content discovery
- Private bookmark encryption using NIP-04
- Proper event validation for all supported kinds (20, 22, 34236)
- Video content validation and thumbnail generation
- Vertical video orientation validation

## Client Behavior

Zappix clients should:
1. Validate all media events against NIP-68 (images) and vertical video requirements (kinds 22, 34236)
2. Support multiple media files in single posts
3. Display content warnings appropriately for both images and videos
4. Implement efficient relay-level filtering for hashtags
5. Verify zap receipts according to NIP-57 validation rules
6. Support nested comment threads with proper threading
7. Handle video playback controls and muting
8. Generate and display video thumbnails
9. Reject horizontal videos during upload (only vertical videos allowed)
10. Optimize video display for mobile portrait viewing
11. Support both kind 22 and kind 34236 vertical video events