import { useSeoMeta } from '@unhead/react';
import { useLocation } from 'react-router-dom';
import { MainLayout } from "@/components/MainLayout";

const Index = () => {
  const location = useLocation();
  
  // Dynamic SEO based on the current route
  const getSeoMeta = () => {
    switch (location.pathname) {
      case '/videos':
        return {
          title: 'Flix - ZapTok',
          description: 'Discover and share vertical videos on the decentralized Nostr network. TikTok-style feed with short-form content from creators worldwide.',
        };
      case '/discover':
        return {
          title: 'Discover - ZapTok',
          description: 'Explore trending hashtags and discover new content on the decentralized Nostr network.',
        };
      default:
        return {
          title: 'ZapTok - Social Media on Nostr',
          description: 'Share and discover amazing images and videos on the decentralized Nostr network. Built with React, TailwindCSS, and Nostrify.',
        };
    }
  };

  const seoMeta = getSeoMeta();
  useSeoMeta(seoMeta);

  return <MainLayout key="main-layout" />;
};

export default Index;
