import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { ImagePost } from './ImagePost';
import type { NostrEvent } from '@nostrify/nostrify';

const mockEvent: NostrEvent = {
  id: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  pubkey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  created_at: Math.floor(Date.now() / 1000),
  kind: 20,
  content: 'Test image post content',
  tags: [
    ['title', 'Test Image'],
    ['imeta', 'url https://example.com/image.jpg', 'alt Test image'],
    ['t', 'photography'],
    ['t', 'nature'],
  ],
  sig: 'test-signature',
};

const mockEventMultipleImages: NostrEvent = {
  id: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  pubkey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  created_at: Math.floor(Date.now() / 1000),
  kind: 20,
  content: 'Test image post with multiple images',
  tags: [
    ['title', 'Multiple Images'],
    ['imeta', 'url https://example.com/image1.jpg', 'alt First image'],
    ['imeta', 'url https://example.com/image2.jpg', 'alt Second image'],
    ['imeta', 'url https://example.com/image3.jpg', 'alt Third image'],
    ['t', 'photography'],
  ],
  sig: 'test-signature',
};

describe('ImagePost', () => {
  it('renders hashtag badges as clickable when onHashtagClick is provided', () => {
    const mockHashtagClick = vi.fn();
    
    render(
      <TestApp>
        <ImagePost event={mockEvent} onHashtagClick={mockHashtagClick} />
      </TestApp>
    );

    // Check that hashtag badges are rendered
    expect(screen.getByText('photography')).toBeInTheDocument();
    expect(screen.getByText('nature')).toBeInTheDocument();
  });

  it('calls onHashtagClick when hashtag badge is clicked', () => {
    const mockHashtagClick = vi.fn();
    
    render(
      <TestApp>
        <ImagePost event={mockEvent} onHashtagClick={mockHashtagClick} />
      </TestApp>
    );

    // Click on the photography hashtag
    const photographyBadge = screen.getByText('photography');
    fireEvent.click(photographyBadge);

    // Verify the callback was called with the correct hashtag
    expect(mockHashtagClick).toHaveBeenCalledWith('photography');
  });

  it('prevents event bubbling when hashtag is clicked', () => {
    const mockHashtagClick = vi.fn();
    const mockContainerClick = vi.fn();
    
    render(
      <TestApp>
        <div onClick={mockContainerClick}>
          <ImagePost event={mockEvent} onHashtagClick={mockHashtagClick} />
        </div>
      </TestApp>
    );

    // Click on the photography hashtag
    const photographyBadge = screen.getByText('photography');
    fireEvent.click(photographyBadge);

    // Verify the hashtag callback was called but container click was not
    expect(mockHashtagClick).toHaveBeenCalledWith('photography');
    expect(mockContainerClick).not.toHaveBeenCalled();
  });

  it('renders hashtag badges as non-clickable when onHashtagClick is not provided', () => {
    render(
      <TestApp>
        <ImagePost event={mockEvent} />
      </TestApp>
    );

    // Check that hashtag badges are rendered but not clickable
    const photographyBadge = screen.getByText('photography');
    expect(photographyBadge).toBeInTheDocument();
    
    // The badge should not have cursor-pointer class when no click handler is provided
    expect(photographyBadge.closest('.cursor-pointer')).toBeNull();
  });

  it('does not render hashtags section when no hashtags are present', () => {
    const eventWithoutHashtags: NostrEvent = {
      ...mockEvent,
      tags: [
        ['title', 'Test Image'],
        ['imeta', 'url https://example.com/image.jpg', 'alt Test image'],
      ],
    };

    render(
      <TestApp>
        <ImagePost event={eventWithoutHashtags} />
      </TestApp>
    );

    // Check that no hashtag badges are rendered
    expect(screen.queryByText('photography')).not.toBeInTheDocument();
    expect(screen.queryByText('nature')).not.toBeInTheDocument();
  });

  it('renders single image without carousel controls', () => {
    render(
      <TestApp>
        <ImagePost event={mockEvent} />
      </TestApp>
    );

    // Check that the image is rendered
    const image = screen.getByAltText('Test image');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', 'https://example.com/image.jpg');

    // Check that carousel controls are not present for single image
    expect(screen.queryByRole('button', { name: /previous slide/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /next slide/i })).not.toBeInTheDocument();
    expect(screen.queryByText('1 / 1')).not.toBeInTheDocument();
  });

  it('renders multiple images with carousel controls', () => {
    render(
      <TestApp>
        <ImagePost event={mockEventMultipleImages} />
      </TestApp>
    );

    // Check that all images are rendered
    expect(screen.getByAltText('First image')).toBeInTheDocument();
    expect(screen.getByAltText('Second image')).toBeInTheDocument();
    expect(screen.getByAltText('Third image')).toBeInTheDocument();

    // Check that carousel controls are present for multiple images
    expect(screen.getByRole('button', { name: /previous slide/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next slide/i })).toBeInTheDocument();
    
    // Check that image counter is present
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('does not render when no images are present', () => {
    const eventWithoutImages: NostrEvent = {
      ...mockEvent,
      tags: [
        ['title', 'Test Post'],
        ['t', 'photography'],
      ],
    };

    const { container } = render(
      <TestApp>
        <ImagePost event={eventWithoutImages} />
      </TestApp>
    );

    // Component should not render anything when no images are present
    expect(container.firstChild).toBeNull();
  });

  it('renders profile information correctly for single image posts', () => {
    render(
      <TestApp>
        <ImagePost event={mockEvent} />
      </TestApp>
    );

    // Check that profile information is rendered
    expect(screen.getByText('Swift Falcon')).toBeInTheDocument(); // Generated name from genUserName
    expect(screen.getByText('S')).toBeInTheDocument(); // Avatar fallback letter
    expect(screen.getByText(new Date(mockEvent.created_at * 1000).toLocaleDateString())).toBeInTheDocument();
  });

  it('renders profile information correctly for multiple image posts', () => {
    render(
      <TestApp>
        <ImagePost event={mockEventMultipleImages} />
      </TestApp>
    );

    // Check that profile information is rendered for carousel posts
    expect(screen.getByText('Swift Falcon')).toBeInTheDocument(); // Generated name from genUserName
    expect(screen.getByText('S')).toBeInTheDocument(); // Avatar fallback letter
    expect(screen.getByText(new Date(mockEventMultipleImages.created_at * 1000).toLocaleDateString())).toBeInTheDocument();
  });
});