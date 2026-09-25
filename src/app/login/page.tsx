import { redirect } from 'next/navigation';
import { getSessionUser } from '@/server/auth';
import { DEFAULT_ROUTE } from '@/lib/rbac';
import { LoginForm } from '@/components/auth/LoginForm';

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect(DEFAULT_ROUTE[user.role]);
  return <LoginForm />;
}
