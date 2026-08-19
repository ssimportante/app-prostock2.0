'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import { ProfileManager } from './ProfileManager';
import { UserManagement } from './UserManagement';
import { AppUser } from '@/types';
import { ProtectedComponent } from '../auth/ProtectedComponent';

interface UserSettingsProps {
    allUsers: AppUser[];
}

export function UserSettings({ allUsers }: UserSettingsProps) {
  const { appUser } = useAuth();
  
  return (
    <div className="space-y-8">
      <ProfileManager currentUser={appUser} />

      <ProtectedComponent roles={['admin']}>
        <UserManagement allUsers={allUsers} currentUserId={appUser?.uid} />
      </ProtectedComponent>
    </div>
  );
}
