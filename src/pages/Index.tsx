import { useSeoMeta } from '@unhead/react';
import { MainLayout } from "@/components/MainLayout";

const Index = () => {
  useSeoMeta({
    title: 'Zappix - Social Image Sharing on Nostr',
    description: 'Share and discover amazing images on the decentralized Nostr network. Built with React, TailwindCSS, and Nostrify.',
  });

  return <MainLayout key="main-layout" />;
};

export default Index;
