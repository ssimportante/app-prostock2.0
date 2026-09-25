'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, UserPlus } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/components/providers/SessionProvider';
import { api, ApiError } from '@/lib/api-client';
import { ROLE_LABEL } from '@/lib/rbac';
import type { AppUser, Role } from '@/lib/types';

const ROLES: Role[] = ['admin', 'manager', 'stock-manager', 'user'];

export function UsersTab() {
  const { user: me } = useSession();
  const { toast } = useToast();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('user');
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const data = await api<{ users: AppUser[] }>('/api/users');
    setUsers(data.users);
  };

  useEffect(() => {
    void reload();
  }, []);

  const addUser = async () => {
    setBusy(true);
    try {
      await api('/api/users', { method: 'POST', body: { name, email, password, role } });
      setName('');
      setEmail('');
      setPassword('');
      await reload();
      toast({ title: 'User invited', description: `${name} can now sign in.` });
    } catch (e) {
      toast({
        title: 'Could not add user',
        description: e instanceof ApiError ? e.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (target: AppUser, newRole: Role) => {
    try {
      await api(`/api/users/${target.id}`, { method: 'PATCH', body: { role: newRole } });
      await reload();
      toast({ title: 'Role updated', description: `${target.name} is now ${ROLE_LABEL[newRole]}` });
    } catch (e) {
      toast({
        title: 'Could not change role',
        description: e instanceof ApiError ? e.message : 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const deleteUser = async (target: AppUser) => {
    try {
      await api(`/api/users/${target.id}`, { method: 'DELETE' });
      await reload();
      toast({ title: 'User removed', description: target.name });
    } catch (e) {
      toast({
        title: 'Could not remove user',
        description: e instanceof ApiError ? e.message : 'Please try again',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Card className="shadow-warm">
        <CardHeader>
          <CardTitle className="font-headline text-lg">Team</CardTitle>
          <CardDescription>Roles control which screens each person can open.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                          {u.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium leading-tight">
                          {u.name}
                          {u.id === me.id && (
                            <Badge variant="secondary" className="ml-1.5 font-normal">You</Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select value={u.role} onValueChange={(v) => changeRole(u, v as Role)}>
                      <SelectTrigger className="h-8 w-40 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      disabled={u.id === me.id}
                      onClick={() => deleteUser(u)}
                      aria-label={`Remove ${u.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="shadow-warm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-headline text-lg">
            <UserPlus className="h-[18px] w-[18px] text-primary" /> Add a teammate
          </CardTitle>
          <CardDescription>Create an account they can sign in with.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="new-name">Name</Label>
            <Input id="new-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jamie Rivera" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-email">Email</Label>
            <Input
              id="new-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jamie@beanespress.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">Temporary password</Label>
            <Input
              id="new-password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="btn-press w-full"
            onClick={addUser}
            disabled={busy || !name.trim() || !email.trim() || password.length < 6}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
