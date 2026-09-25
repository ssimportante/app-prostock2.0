import { requirePageUser } from '@/server/auth';
import { DashboardClient } from '@/components/dashboard/DashboardClient';

export default async function DashboardPage() {
  await requirePageUser(['admin', 'manager', 'user']);
  return <DashboardClient />;
}
