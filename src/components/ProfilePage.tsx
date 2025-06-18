import { useSeoMeta } from '@unhead/react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from "./MainLayout";
import { UserProfileView } from "./UserProfileView";

interface ProfilePageProps {
  onEditClick?: () => void;
}

export function ProfilePage({ onEditClick }: ProfilePageProps) {
  const navigate = useNavigate();

  useSeoMeta({
    title: 'Your Profile - Zappix',
    description: 'View and manage your Nostr profile on Zappix.',
  });

  const handleEditClick = onEditClick || (() => navigate('/profile/edit'));

  return (
    <MainLayout>
      <UserProfileView onEditClick={handleEditClick} />
    </MainLayout>
  );
}
