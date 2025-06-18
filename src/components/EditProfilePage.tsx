import { Settings, User, ArrowLeft } from 'lucide-react';
import { useSeoMeta } from '@unhead/react';
import { useNavigate } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EditProfileForm } from './EditProfileForm';
import { MainLayout } from './MainLayout';

interface EditProfilePageProps {
  onBackClick?: () => void;
}

export function EditProfilePage({ onBackClick }: EditProfilePageProps) {
  const { user } = useCurrentUser();
  const navigate = useNavigate();

  useSeoMeta({
    title: 'Edit Profile - Zappix',
    description: 'Edit your Nostr profile information on Zappix.',
  });

  const handleBackClick = onBackClick || (() => navigate('/profile'));
  
  if (!user) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 px-8 text-center">
          <div className="max-w-sm mx-auto space-y-6">
            <User className="h-12 w-12 text-muted-foreground mx-auto" />
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Login Required</h3>
              <p className="text-muted-foreground">
                Please log in to edit your profile
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const content = (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            onClick={handleBackClick}
            variant="outline"
            size="sm"
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Profile</span>
          </Button>
          <div className="space-y-1">
            <h2 className="text-2xl font-bold flex items-center space-x-2">
              <Settings className="h-6 w-6" />
              <span>Edit Profile</span>
            </h2>
            <p className="text-muted-foreground">
              Update your Nostr profile information
            </p>
          </div>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Profile Settings</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EditProfileForm />
        </CardContent>
      </Card>
    </div>
  );

  // If onBackClick is provided, render without MainLayout (for embedded use)
  if (onBackClick) {
    return content;
  }

  // Otherwise, render with MainLayout (for route use)
  return <MainLayout>{content}</MainLayout>;
}