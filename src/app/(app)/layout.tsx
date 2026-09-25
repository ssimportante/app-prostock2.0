import { requirePageUser } from '@/server/auth';
import { AppShell } from '@/components/shell/AppShell';
import { SessionProvider } from '@/components/providers/SessionProvider';
import { SettingsProvider } from '@/contexts/SettingsProvider';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  return (
    <SessionProvider user={user}>
      <SettingsProvider>
        <AppShell>{children}</AppShell>
      </SettingsProvider>
    </SessionProvider>
  );
}
