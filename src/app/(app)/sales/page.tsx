import { requirePageUser } from '@/server/auth';
import { PosClient } from '@/components/pos/PosClient';

export default async function SalesPage() {
  await requirePageUser(['admin', 'manager', 'user']);
  return <PosClient />;
}
