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

### NIP-25 (Kind 7) - Reactions
Image posts support emoji reactions using kind 7 events:
- `+` or empty content for likes
- `-` for dislikes  
- Custom emoji reactions
- Required `e` tag pointing to the image post
- Required `p` tag pointing to the image post author

### NIP-57 (Kind 9734/9735) - Lightning Zaps
Zap support for image posts:
- Kind 9734: Zap requests sent to LNURL endpoints
- Kind 9735: Zap receipts published by lightning wallets
- Integration with Nostr Wallet Connect for seamless zapping

### NIP-22 (Kind 1111) - Comments
Comments on image posts using kind 1111:
- `E` tag pointing to the root image post (kind 20)
- `K` tag with value "20" indicating the root kind
- `P` tag pointing to the image post author
- Support for nested comment threads

### NIP-51 (Kind 10003) - Bookmarks
Bookmark functionality using the standard bookmarks list:
- Kind 10003 replaceable events
- `e` tags referencing bookmarked image posts
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

Zappix integrates with Blossom servers (NIP-96) for media storage:
- Kind 10063 events define user's preferred Blossom servers
- Multiple image uploads supported per post
- NIP-94 compatible file metadata tags

## Security Considerations

- Image post verification using SHA-256 hashes in `imeta` tags
- Relay hints for efficient content discovery
- Private bookmark encryption using NIP-04
- Proper event validation for all supported kinds

## Client Behavior

Zappix clients should:
1. Validate all image events against NIP-68 requirements
2. Support multiple image galleries in single posts
3. Display content warnings appropriately
4. Implement efficient relay-level filtering for hashtags
5. Verify zap receipts according to NIP-57 validation rules
6. Support nested comment threads with proper threading