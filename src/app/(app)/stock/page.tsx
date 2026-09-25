import { requirePageUser } from '@/server/auth';
import { StockClient } from '@/components/stock/StockClient';

export default async function StockPage() {
  await requirePageUser(['admin', 'manager', 'stock-manager']);
  return <StockClient />;
}
