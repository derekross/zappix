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
});