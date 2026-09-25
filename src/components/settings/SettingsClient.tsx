'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSession } from '@/components/providers/SessionProvider';
import { GeneralTab } from './GeneralTab';
import { CategoriesTab } from './CategoriesTab';
import { StationsTab } from './StationsTab';
import { TaxesTab } from './TaxesTab';
import { UsersTab } from './UsersTab';

export function SettingsClient() {
  const { user } = useSession();
  return (
    <div className="space-y-4 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="font-headline text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Shop configuration, catalog metadata, and team management.
        </p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="flex-wrap">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="stations">Stations</TabsTrigger>
          <TabsTrigger value="taxes">Taxes</TabsTrigger>
          {user.role === 'admin' && <TabsTrigger value="users">Users</TabsTrigger>}
        </TabsList>
        <TabsContent value="general" className="mt-4">
          <GeneralTab />
        </TabsContent>
        <TabsContent value="categories" className="mt-4">
          <CategoriesTab />
        </TabsContent>
        <TabsContent value="stations" className="mt-4">
          <StationsTab />
        </TabsContent>
        <TabsContent value="taxes" className="mt-4">
          <TaxesTab />
        </TabsContent>
        {user.role === 'admin' && (
          <TabsContent value="users" className="mt-4">
            <UsersTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
