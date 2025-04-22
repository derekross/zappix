// src/components/MarkdownContent.tsx
import React from "react";
// FIX: Remove unused 'Options' import
import ReactMarkdownImport, { Components } from "react-markdown"; // Import under different name
import remarkGfm from "remark-gfm";
import { Link, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom"; // v6

interface MarkdownContentProps {
  content: string;
}

// Define the type for the props received by the custom renderer
// AnchorHTMLAttributes covers standard props like href, title, children etc.
// Add 'node' which is specific to react-markdown's AST node
type CustomAnchorRendererProps =
  React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    node?: any;
  };

// Type the functional component explicitly
const CustomAnchorRendererComponent: React.FC<CustomAnchorRendererProps> = ({
  node, // We can destructure node even if not used, to satisfy the type
  children,
  href,
  ...props // Capture rest of the standard Anchor attributes
}) => {
  const targetHref = href || "";

  // Internal links
  if (targetHref.startsWith("/") || targetHref.startsWith("#")) {
    if (targetHref.startsWith("#")) {
      const tag = targetHref.substring(1);
      // Use MUI Link with component prop - should work now with updated react-markdown
      return (
        <Link component={RouterLink} to={`/t/${tag}`} title={props.title}>
          {children}
        </Link>
      );
    }
    // Other internal links
    return (
      <Link component={RouterLink} to={targetHref} title={props.title}>
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
        title={props.title} // Pass title explicitly
      >
        {children}
      </Link>
    );
  }
};

// Use type assertion for ReactMarkdown component ONLY if necessary after update
// Often, updating react-markdown fixes the need for this. Try removing it first.
// const ReactMarkdown = ReactMarkdownImport as any;
// If removing 'as any' causes errors again, keep it. Otherwise, prefer the direct import:
const ReactMarkdown = ReactMarkdownImport;

export const MarkdownContent: React.FC<MarkdownContentProps> = ({
  content,
}) => {
  // Define the components mapping
  const markdownComponents: Components = {
    a: CustomAnchorRendererComponent, // Assign the typed component
  };

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
