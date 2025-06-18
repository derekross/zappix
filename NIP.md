# Custom Nostr Implementation

This document describes the custom Nostr event implementations in this client application.

## Bookmarks Implementation

This client uses NIP-51 bookmark sets (kind 30003) for storing user bookmarks, specifically using the `d` tag value "nip-68-posts" to create a dedicated bookmark set for posts from this application.

### Bookmark Set Format

```json
{
  "kind": 30003,
  "content": "",
  "tags": [
    ["d", "nip-68-posts"],
    ["title", "NIP-68 Image Bookmarks"],
    ["description", "Images bookmarked from Zappix"],
    ["e", "event_id_1"],
    ["e", "event_id_2"]
  ]
}
```

**Required Tags:**

- `d`: Must be "nip-68-posts" to identify this application's bookmark set
- `title`: Human-readable title for the bookmark set
- `description`: Description of what this bookmark set contains

**Event References:**

- `e` tags: Reference bookmarked events by their event ID
- Only kind 20 (image posts) events are displayed in the bookmarks page

### Implementation Details

- **Kind**: 30003 (NIP-51 bookmark sets)
- **Identifier**: "nip-68-posts" (stored in `d` tag)
- **Replaceability**: Each user can have only one bookmark set with this identifier
- **Content Filtering**: Only kind 20 events are shown in the bookmarks interface
- **Auto-creation**: Empty bookmark set is created automatically when user first bookmarks a post

This approach allows users to have multiple bookmark sets (using different `d` tag values) while keeping this application's bookmarks organized in a dedicated set.

## Short Vertical Video Events with Legacy Support

This document also describes the video event implementation in this Nostr client, which focuses on short vertical videos while maintaining backward compatibility with existing video formats.

## Publishing Restrictions

This client enforces strict requirements for video uploads to maintain a consistent short-form vertical video experience:

### Upload Requirements

- **Orientation**: Must be vertical/portrait (height > width)
- **Duration**: Maximum 3 minutes (180 seconds)
- **Format**: MP4, WebM, or MOV files only

Videos that don't meet these requirements will be rejected during upload with clear error messages.

## Supported Event Kinds

### Published Video Events

When users upload videos, this client publishes:

- **Kind 22**: Short-form portrait video events (NIP-71 compliant)

All uploaded videos are published as kind 22 events with:

- Required `title` tag (auto-generated from description or user content)
- `imeta` tags for video metadata including URL, MIME type, dimensions
- `duration` tag with video length in seconds
- Optional tags: `content-warning`, `alt`, `location`, `t` (hashtags), etc.

### Display Support (Backward Compatibility)

For viewing content, this client supports multiple video formats:

- **Kind 21**: Normal video events (typically landscape/horizontal videos)
- **Kind 22**: Short-form portrait video events (typically vertical videos)
- **Kind 34236**: Legacy vertical video events

#### Kind 34236 Format

Legacy vertical video events (kind 34236) use a simpler format:

```json
{
  "kind": 34236,
  "content": "Video description with video URL: https://example.com/video.mp4",
  "tags": [
    ["url", "https://example.com/video.mp4"],
    ["t", "hashtag1"],
    ["t", "hashtag2"]
  ]
}
```

**Validation Rules for Kind 34236:**

- Must contain a video URL (`.mp4`, `.webm`, or `.mov`) in either:
  - The `content` field, or
  - A `url` tag
- All kind 34236 events are assumed to be vertical videos
- No `title` or `imeta` tags required (legacy format)

## Publishing Behavior

When publishing videos, this client:

1. **Validates Requirements**: Checks orientation (must be vertical) and duration (max 3 minutes)
2. **Uploads to Blossom**: Uses NIP-96 compatible Blossom servers for file storage
3. **Extracts Metadata**: Gets video dimensions, duration, and generates thumbnails when possible
4. **Creates NIP-71 Event**: Always publishes as kind 22 with proper `imeta` tags
5. **Auto-generates Title**: Uses first line of description or creates a default title

## Video Feed Filtering

The client provides filtering options for video feeds when viewing content:

- **All**: Shows all video types (kinds 21, 22, and 34236)
- **Vertical**: Shows only vertical videos (kind 22, kind 34236, and kind 21 with vertical dimensions)
- **Horizontal**: Shows only horizontal videos (kind 21 with horizontal dimensions)

This allows users to view content from other clients while maintaining the short vertical video focus for publishing.

## Implementation Notes

### Upload Validation

The client performs strict validation during upload:

1. **File Type Check**: Only accepts video files (MP4, WebM, MOV)
2. **Orientation Check**: Rejects horizontal videos (width >= height)
3. **Duration Check**: Rejects videos longer than 3 minutes (180 seconds)
4. **Real-time Feedback**: Shows clear error messages for rejected uploads

### Event Validation (Display)

The client validates video events for display based on their kind:

1. **NIP-71 events (kinds 21, 22)**: Require `title` tag and `imeta` tag with video URL
2. **Legacy events (kind 34236)**: Require video URL in content or `url` tag

### Display

All video types are displayed using the same VideoPost component, which:

- Extracts video URLs from `imeta` tags (NIP-71) or content/url tags (legacy)
- Shows video metadata when available (title, duration, dimensions)
- Supports content warnings, hashtags, and location tags
- Provides video controls (play/pause, mute/unmute)

### User Experience

The upload interface clearly communicates requirements:

- Visual indicators showing orientation and duration limits
- Real-time validation with helpful error messages
- Preview of uploaded videos with duration display
- Automatic title generation from user content

This implementation creates a TikTok-like experience focused on short vertical videos while maintaining compatibility with the broader Nostr video ecosystem for viewing content.
