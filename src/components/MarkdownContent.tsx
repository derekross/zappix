// src/components/MarkdownContent.tsx
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

interface MarkdownContentProps {
    content: string;
}

// Basic component to render markdown content
// Handles standard markdown + GFM features
// Converts standard links to MUI Links
// Converts relative links (like /t/hashtag) to RouterLinks
export const MarkdownContent: React.FC<MarkdownContentProps> = ({ content }) => {
    return (
        <Typography component="div" variant="body1" sx={{ wordBreak: 'break-word' }}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]} // Enable GitHub Flavored Markdown
                components={{
                    // Render links using MUI Link or React Router Link
                    a: ({ node, ...props }) => {
                        const href = props.href || '';
                        // Check if it's an internal app link (e.g., /t/..., /n/... /profile/...)
                        if (href.startsWith('/') || href.startsWith('#')) {
                            // Use React Router Link for internal navigation
                             // Check if it's just a hashtag link without the path
                             if (href.startsWith('#')) {
                                 // Assuming hashtags should link to /t/...
                                 const tag = href.substring(1);
                                 return <Link component={RouterLink} to={`/t/${tag}`} {...props} />; 
                             }
                            return <Link component={RouterLink} to={href} {...props} />;
                        } else {
                            // Use standard MUI Link for external URLs
                            return <Link href={href} target="_blank" rel="noopener noreferrer" {...props} />;
                        }
                    },
                    // Add other custom renderers if needed (e.g., for nostr: links)
                }}
            >
                {content}
            </ReactMarkdown>
        </Typography>
    );
};
