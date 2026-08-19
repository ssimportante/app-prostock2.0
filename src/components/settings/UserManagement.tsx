
'use client';

import { useState, useTransition } from 'react';
import { AppUser, UserRole } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Edit, Loader2, User, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';

interface UserManagementProps {
  allUsers: AppUser[];
  currentUserId: string | undefined;
}

async function updateUserRoleAction(firestore: any, uid: string, role: UserRole) {
    await updateDoc(doc(firestore, 'users', uid), { role });
}

export function UserManagement({ allUsers, currentUserId }: UserManagementProps) {
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('user');
  const [isPending, startTransition] = useTransition();
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

  const roleColors: Record<UserRole, string> = {
    admin: 'bg-red-500',
    manager: 'bg-yellow-500',
    'stock-manager': 'bg-green-500',
    user: 'bg-blue-500',
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8 border-t">
       <div className="md:col-span-1">
        <h2 className="text-xl font-semibold">User Management</h2>
        <p className="text-sm text-muted-foreground">Manage roles for all application users.</p>
      </div>
      <div className="md:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users /> All Users</CardTitle>
            <CardDescription>View and manage user roles across the application.</CardDescription>
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
                          <Button variant="ghost" size="icon" onClick={() => handleEditClick(user)} disabled={isPowerAdmin}>
                            <Edit className="h-4 w-4" />
                          </Button>
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
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="stock-manager">Stock Manager</SelectItem>
                <SelectItem value="user">User</SelectItem>
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
    </div>
  );
}
