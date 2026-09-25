import { requirePageUser } from '@/server/auth';
import { TicketBoard } from '@/components/kds/TicketBoard';

export default async function KdsPage() {
  await requirePageUser(['admin', 'manager', 'stock-manager', 'user']);
  return <TicketBoard variant="kitchen" />;
}
