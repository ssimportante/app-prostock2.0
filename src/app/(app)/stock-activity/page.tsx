import { requirePageUser } from '@/server/auth';
import { StockActivityClient } from '@/components/stock/StockActivityClient';

export default async function StockActivityPage() {
  await requirePageUser(['admin', 'stock-manager']);
  return <StockActivityClient />;
}
