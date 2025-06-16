import { User } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EditProfileForm } from './EditProfileForm';

export function ProfilePage() {
  const { user } = useCurrentUser();
  
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

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold flex items-center justify-center space-x-2">
          <User className="h-6 w-6" />
          <span>Edit Profile</span>
        </h2>
        <p className="text-muted-foreground">
          Update your Nostr profile information
        </p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>Profile Settings</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EditProfileForm />
        </CardContent>
      </Card>
    </div>
  );
}