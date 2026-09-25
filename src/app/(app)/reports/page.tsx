import { requirePageUser } from '@/server/auth';
import { ReportsClient } from '@/components/reports/ReportsClient';

export default async function ReportsPage() {
  await requirePageUser(['admin', 'manager']);
  return <ReportsClient />;
}
