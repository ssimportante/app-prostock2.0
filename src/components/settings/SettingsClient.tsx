
'use client';

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { CategoryWithId, SubcategoryWithId, StationWithId, TaxWithId, AppUser, StaffWithId } from '@/types';
import { SlidersHorizontal, Package, Users } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { PosSettingsManager } from '@/components/settings/PosSettingsManager';
import { PrinterSettingsManager } from '@/components/settings/PrinterSettingsManager';
import { TaxManager } from '@/components/settings/TaxManager';
import { CategoriesManager } from '@/components/settings/CategoriesManager';
import { SubcategoriesManager } from '@/components/settings/SubcategoriesManager';
import { StationsManager } from '@/components/settings/StationsManager';
import { TagsManager } from '@/components/settings/TagsManager';
import { UserSettings } from '@/components/settings/UserSettings';
import { StaffManager } from '@/components/settings/StaffManager';

interface SettingsClientProps {
  categories: CategoryWithId[];
  stations: StationWithId[];
  taxes: TaxWithId[];
  users: AppUser[];
  staff: StaffWithId[];
}

export default function SettingsClient({ categories, stations, taxes, users, staff }: SettingsClientProps) {
  const firestore = useFirestore();
  const subcategoriesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'subcategories'));
  }, [firestore]);
  const { data: subcategories } = useCollection<SubcategoryWithId>(subcategoriesQuery);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-headline font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your application settings.</p>
      </div>
      
      <Tabs defaultValue="general" className="w-full">
        <div className="md:hidden mb-4">
          <TabsList className="grid w-full grid-cols-3 h-auto">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="properties">Item Properties</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
          </TabsList>
        </div>
        <div className="md:grid md:grid-cols-[200px_1fr] md:gap-8">
            <TabsList className="w-full flex-col items-stretch justify-start h-auto bg-transparent p-0 space-y-1 hidden md:flex">
                <TabsTrigger value="general" className="justify-start gap-2">
                    <SlidersHorizontal className="h-4 w-4" />
                    General
                </TabsTrigger>
                <TabsTrigger value="properties" className="justify-start gap-2">
                    <Package className="h-4 w-4" />
                    Item Properties
                    </TabsTrigger>
                <TabsTrigger value="users" className="justify-start gap-2">
                    <Users className="h-4 w-4" />
                    Users
                </TabsTrigger>
            </TabsList>
            <div className="mt-4 md:mt-0">
                <TabsContent value="general" className="mt-0">
                    <div className="grid gap-6">
                        <PosSettingsManager />
                        <PrinterSettingsManager />
                        <TaxManager initialTaxes={taxes} />
                    </div>
                </TabsContent>
                <TabsContent value="properties" className="mt-0">
                    <div className="grid gap-6">
                        <CategoriesManager initialCategories={categories} />
                        <SubcategoriesManager initialSubcategories={subcategories || []} categories={categories} />
                        <StationsManager initialStations={stations} />
                        <StaffManager initialStaff={staff} />
                        <TagsManager />
                    </div>
                </TabsContent>
                <TabsContent value="users" className="mt-0">
                    <UserSettings allUsers={users} />
                </TabsContent>
            </div>
        </div>
      </Tabs>
    </div>
  );
}
