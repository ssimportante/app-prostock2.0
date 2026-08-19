'use client';

import React from 'react';

interface ProtectedComponentProps {
  children: React.ReactNode;
  roles: string[]; // Roles are not checked anymore
}

export function ProtectedComponent({ children, roles }: ProtectedComponentProps) {
  // Since authentication is removed, we render all children.
  return <>{children}</>;
}
