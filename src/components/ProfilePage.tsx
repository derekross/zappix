import { UserProfileView } from './UserProfileView';

interface ProfilePageProps {
  onEditClick?: () => void;
}

export function ProfilePage({ onEditClick }: ProfilePageProps) {
  return <UserProfileView onEditClick={onEditClick} />;
}