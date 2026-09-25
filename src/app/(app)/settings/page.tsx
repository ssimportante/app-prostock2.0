import { requirePageUser } from '@/server/auth';
import { SettingsClient } from '@/components/settings/SettingsClient';

export default async function SettingsPage() {
  await requirePageUser(['admin', 'manager']);
  return <SettingsClient />;
}
