import { requirePageUser } from '@/server/auth';
import { ItemsClient } from '@/components/items/ItemsClient';

export default async function ItemsPage() {
  await requirePageUser(['admin', 'manager']);
  return <ItemsClient />;
}
