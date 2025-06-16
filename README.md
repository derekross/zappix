# Zappix - Social Image Sharing on Nostr

Zappix is a modern social image sharing application built on the decentralized Nostr protocol. Share and discover amazing images with a vibrant community while maintaining full ownership of your data.

## Features

### 🖼️ Image Sharing
- **NIP-68 Image Posts**: Share single or multiple images with rich metadata
- **Multiple Upload**: Upload multiple images per post with drag & drop support
- **Image Metadata**: Automatic extraction of dimensions, MIME types, and SHA-256 hashes
- **Content Warnings**: Mark sensitive content appropriately

### 🌐 Social Features
- **Reactions (NIP-25)**: Like posts with emoji reactions
- **Comments (NIP-22)**: Threaded comment system with replies
- **Zaps (NIP-57)**: Lightning payments for content appreciation
- **Bookmarks (NIP-51)**: Save your favorite posts
- **Following**: Follow users and see their posts in a dedicated feed

### 🏷️ Discovery
- **Hashtag System**: Organize content with hashtags for easy discovery
- **Featured Hashtags**: Curated hashtag categories (#olas, #photography, #art, etc.)
- **Global Feed**: Discover content from across the network
- **Following Feed**: See posts from people you follow

### ⚡ Advanced Features
- **Outbox Model (NIP-65)**: Efficient content discovery using relay hints
- **Nostr Wallet Connect**: Seamless zapping with wallet integration
- **Blossom Media Servers**: Decentralized media storage
- **Responsive Design**: Works perfectly on desktop and mobile

### 🎨 User Experience
- **Orange & Purple Theme**: Vibrant, modern color scheme
- **Dark/Light Mode**: Automatic theme switching
- **Mobile Optimized**: Touch-friendly interface for mobile devices
- **Progressive Web App**: Install as a native app

## Technology Stack

- **React 18** - Modern UI framework with hooks and concurrent rendering
- **TypeScript** - Type-safe development
- **TailwindCSS** - Utility-first styling
- **Vite** - Fast build tool and development server
- **shadcn/ui** - Beautiful, accessible UI components
- **Nostrify** - Nostr protocol integration
- **TanStack Query** - Data fetching and caching
- **React Router** - Client-side routing

## Nostr Protocol Implementation

Zappix implements several Nostr Improvement Proposals (NIPs):

- **NIP-68 (Kind 20)**: Picture events for image-centric content
- **NIP-25 (Kind 7)**: Reactions and emoji responses
- **NIP-57 (Kind 9734/9735)**: Lightning zaps for content monetization
- **NIP-22 (Kind 1111)**: Threaded comments system
- **NIP-51 (Kind 10003)**: Bookmarks and content curation
- **NIP-65 (Kind 10002)**: Relay list metadata for outbox model
- **NIP-04**: Encrypted private bookmarks

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd zappix
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser to `http://localhost:5173`

### Building for Production

```bash
npm run build
```

### Running Tests

```bash
npm test
```

## Usage

### Getting Started
1. **Connect Your Nostr Identity**: Use any Nostr extension (like Alby, nos2x) or enter your private key
2. **Upload Images**: Click the "+" button to create your first image post
3. **Add Details**: Include a title, description, hashtags, and location
4. **Publish**: Share your post with the Nostr network

### Discovering Content
- **Global Feed**: Browse all image posts from connected relays
- **Following Feed**: See posts from users you follow
- **Hashtag Discovery**: Explore curated hashtag categories
- **Search**: Find specific content using hashtags

### Interacting
- **React**: Show appreciation with emoji reactions
- **Comment**: Engage in threaded discussions
- **Zap**: Send lightning payments to creators
- **Bookmark**: Save posts for later viewing
- **Share**: Copy post links or Nostr event IDs

## Configuration

### Relay Settings
Configure your read/write relays in Settings > Relays for optimal content discovery and publishing.

### Lightning Integration
Connect your lightning wallet via Nostr Wallet Connect in Settings > Zaps for seamless zapping.

### Media Storage
Configure Blossom media servers in Settings > Zaps for decentralized image hosting.

## Contributing

We welcome contributions! Please see our contributing guidelines for details on:
- Code style and standards
- Pull request process
- Issue reporting
- Feature requests

## Security

Zappix prioritizes user security:
- **No Private Key Storage**: Uses Nostr signers for secure key management
- **Content Verification**: SHA-256 hashes verify image integrity
- **Encrypted Bookmarks**: Private bookmarks use NIP-04 encryption
- **CSP Headers**: Content Security Policy prevents XSS attacks

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with [MKStack](https://soapbox.pub/tools/mkstack/) - Modern development stack
- Powered by the [Nostr Protocol](https://nostr.com/) - Decentralized social networking
- UI components from [shadcn/ui](https://ui.shadcn.com/) - Beautiful, accessible components
- Icons from [Lucide](https://lucide.dev/) - Beautiful & consistent icons

## Support

- **Documentation**: Check our [NIP.md](./NIP.md) for protocol implementation details
- **Issues**: Report bugs and request features on GitHub
- **Community**: Join the Nostr community for support and discussions

---

**Vibed with [MKStack](https://soapbox.pub/tools/mkstack/)**