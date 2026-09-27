'use client';

import React from 'react';
import { useAuth } from './AuthProvider';

interface ProtectedComponentProps {
  children: React.ReactNode;
  roles: string[];
}

export function ProtectedComponent({ children, roles }: ProtectedComponentProps) {
  const { appUser } = useAuth();
  if (!appUser || !roles.includes(appUser.role)) {
    return null;
  }
  return <>{children}</>;
}
