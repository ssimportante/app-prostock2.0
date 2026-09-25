import { redirect } from 'next/navigation';
import { getSessionUser } from '@/server/auth';
import { DEFAULT_ROUTE } from '@/lib/rbac';

export default async function Home() {
  const user = await getSessionUser();
  redirect(user ? DEFAULT_ROUTE[user.role] : '/login');
}
