# Zappix

Zappix is a Nostr client focused on providing a clean, image-centric user experience. Built with React, TypeScript, Material UI, and the Nostr Development Kit (NDK).

## Features

*   **Image-Focused Feeds:** View Global and Following feeds primarily displaying image posts (Kind 20 with `imeta` tags).
*   **User Profiles:** View user profiles, including metadata (name, picture, bio) and NIP-05 verification status.
*   **Profile Editing:** Update your own Nostr profile metadata (Kind 0).
*   **Image Uploading:** Upload images via the standard NIP-96 flow (using Blossom servers) with NIP-98 authentication. File metadata is handled via NIP-94 concepts within Kind 20 posts.
*   **Login Options:**
    *   Browser Extension (NIP-07)
    *   Remote Signer / Bunker (NIP-46) (COMING SOON)
*   **Content Blurring:** Automatically blurs images tagged with `#nsfw` or containing a NIP-36 `content-warning` tag. Click to reveal.
*   **Post Interaction:**
    *   View post threads (replies).
    *   Copy Note ID (`nevent` format via NIP-19).
    *   Share posts externally using njump.me links.
    *   Follow / Unfollow post authors (updates Kind 3 Contact List).
    *   Mute / Unmute post authors (updates NIP-51 public Kind 10000 Mute List).
    *   Report posts using NIP-56 (publishes Kind 1984).
*   **Hashtag Feeds:** View posts filtered by a specific hashtag.
*   **Theming:** Switch between Light and Dark modes.

## Supported NIPs

Zappix aims to support modern Nostr standards. Key NIPs currently implemented include:

*   **NIP-01:** Basic protocol flow (Kinds 0, 3).
*   **NIP-05:** Mapping Nostr keys to DNS-based internet identifiers (Profile verification display).
*   **NIP-07:** `window.nostr` capability for browser extensions (Login).
*   **NIP-12:** Generic Tag Queries (Hashtag feed filtering).
*   **NIP-19:** `bech32`-encoded entities (`npub`, `nevent` generation and linking).
*   **NIP-22:** Comments (Kind 1111).
*   **NIP-36:** Sensitive Content tags (`content-warning`).
*   **NIP-46:** Nostr Connect (Remote signer/bunker login). (COMING SOON)
*   **NIP-51:** Lists (Public Kind 10000 Mute Lists).
*   **NIP-56:** Reporting (Kind 1984 Report events).
*   **NIP-20:** Image Feeds (Kind 20 events).
*   **NIP-94:** File Metadata (Used conceptually for image uploads within Kind 20).
*   **NIP-96:** HTTP File Storage Integration (Image uploads via Blossom).
*   **NIP-98:** HTTP Auth (Authentication for NIP-96 uploads).

## Getting Started

*(Add instructions here on how to build, run, and contribute to the project if desired)*
