'use client';

import { useState, useTransition } from 'react';
import { AppUser, UserRole } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Edit, KeyRound, Loader2, User, Users, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { withCsrfHeaders } from '@/lib/csrf-client';

interface UserManagementProps {
  allUsers: AppUser[];
  currentUserId: string | undefined;
}

async function updateUserRoleAction(firestore: any, uid: string, role: UserRole) {
    await updateDoc(doc(firestore, 'users', uid), { role });
}

async function adminCreateUser(payload: { email: string; name: string; role: UserRole; password: string }) {
    const res = await fetch('/api/auth/admin-create-user', {
        method: 'POST',
        headers: withCsrfHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to create user');
    return json.user;
}

async function adminResetPassword(userId: string, newPassword: string) {
    const res = await fetch('/api/auth/admin-reset-password', {
        method: 'POST',
        headers: withCsrfHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ userId, newPassword }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to reset password');
    return json;
}

export function UserManagement({ allUsers, currentUserId }: UserManagementProps) {
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');
  const [isPending, startTransition] = useTransition();

  // Create user dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('kitchen-user');
  const [newPassword, setNewPassword] = useState('');
  const [isCreating, startCreateTransition] = useTransition();

  // Reset password dialog state
  const [resetUser, setResetUser] = useState<AppUser | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [isResetting, startResetTransition] = useTransition();

  const { toast } = useToast();
  const firestore = useFirestore();

  const handleEditClick = (user: AppUser) => {
    setEditingUser(user);
    setSelectedRole(user.role);
  };
  
  const handleRoleChange = (role: UserRole) => {
    setSelectedRole(role);
  }

  const handleSaveRole = () => {
    if (!editingUser) return;

    startTransition(async () => {
        try {
            await updateUserRoleAction(firestore, editingUser.uid, selectedRole);
            toast({ title: 'Success', description: 'User role updated.' });
            setEditingUser(null);
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to update role.' });
        }
    });
  }

  const handleCreateUser = () => {
    startCreateTransition(async () => {
        try {
            await adminCreateUser({ email: newEmail, name: newName, role: newRole, password: newPassword });
            toast({ title: 'Success', description: 'User created successfully.' });
            setShowCreateDialog(false);
            setNewEmail('');
            setNewName('');
            setNewPassword('');
            setNewRole('kitchen-user');
        } catch (error: any) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to create user.' });
        }
    });
  }

  const handleResetPassword = () => {
    if (!resetUser) return;

    startResetTransition(async () => {
        try {
            await adminResetPassword(resetUser.uid, resetPassword);
            toast({ title: 'Success', description: 'Password reset successfully.' });
            setResetUser(null);
            setResetPassword('');
        } catch (error: any) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to reset password.' });
        }
    });
  }

  const roleColors: Record<UserRole, string> = {
    admin: 'bg-red-500',
    'stock-manager': 'bg-green-500',
    'kitchen-user': 'bg-orange-500',
    'bar-user': 'bg-blue-500',
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8 border-t">
       <div className="md:col-span-1">
        <h2 className="text-xl font-semibold">User Management</h2>
        <p className="text-sm text-muted-foreground">Manage roles and passwords for all application users.</p>
      </div>
      <div className="md:col-span-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><Users /> All Users</CardTitle>
                <CardDescription>View and manage user roles across the application.</CardDescription>
              </div>
              <Button size="sm" onClick={() => setShowCreateDialog(true)}>
                <UserPlus className="h-4 w-4 mr-1" />
                Create User
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative w-full overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allUsers.map(user => {
                    const isPowerAdmin = user.email === 'admin@beanespress.com';
                    return (
                      <TableRow key={user.uid}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={user.photoURL || ''} />
                              <AvatarFallback>
                                <User />
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{user.name || 'N/A'}</span>
                          </div>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge className={`${roleColors[user.role]} text-white`}>{user.role}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEditClick(user)} disabled={isPowerAdmin} title="Edit role">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setResetUser(user)} disabled={isPowerAdmin} title="Reset password">
                              <KeyRound className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Role Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Edit User Role</DialogTitle>
            <DialogDescription>
                Change the role for {editingUser?.name || editingUser?.email}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedRole} onValueChange={handleRoleChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="stock-manager">Stock Manager</SelectItem>
                <SelectItem value="kitchen-user">Kitchen User</SelectItem>
                <SelectItem value="bar-user">Bar User</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
            <Button onClick={handleSaveRole} disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>Add a new user account with a specific role and password.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="user@beanespress.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as UserRole)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="stock-manager">Stock Manager</SelectItem>
                  <SelectItem value="kitchen-user">Kitchen User</SelectItem>
                  <SelectItem value="bar-user">Bar User</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateUser} disabled={isCreating || !newEmail || !newPassword}>
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetUser} onOpenChange={(open) => !open && setResetUser(null)}>
        <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {resetUser?.name || resetUser?.email}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetUser(null)}>Cancel</Button>
            <Button onClick={handleResetPassword} disabled={isResetting || !resetPassword}>
                {isResetting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
