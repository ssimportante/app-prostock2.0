
'use client';

import { useState, useTransition, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AppUser } from '@/types';
import { useAuth as useAppAuth } from '@/components/auth/AuthProvider';
import { useAuth, useFirestore, useFirebaseApp } from '@/firebase';
import { getStorage, ref, uploadString, getDownloadURL, deleteObject } from "firebase/storage";
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider, updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, User, Upload } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});


async function updateUserProfileAction (
    firestore: any,
    auth: any,
    storage: any,
    payload: {
        uid: string;
        name: string;
        image?: string | null;
    }
): Promise<Partial<AppUser>> {
    const { uid, name, image } = payload;
  
    let authUpdates: { displayName?: string, photoURL?: string } = { displayName: name };
    let dbUpdates: { name: string, photoURL?: string | null } = { name };

    if (image !== undefined) {
      const user = auth.currentUser;
      
      if (user.photoURL) {
        try {
            const oldFileRef = ref(storage, user.photoURL);
            await deleteObject(oldFileRef);
        } catch (e: any) {
          if (e.code !== 'storage/object-not-found') console.error("Failed to delete old profile picture:", e.message);
        }
      }
  
      if (image) { 
        const imageBuffer = Buffer.from(image.split(',')[1], 'base64');
        const mimeType = image.match(/data:(.*);base64,/)?.[1];
        const fileName = `pfps/${uid}-${Date.now()}`;
        const fileRef = ref(storage, fileName);
  
        await uploadString(fileRef, image, 'data_url');
        const newPhotoURL = await getDownloadURL(fileRef);
        
        authUpdates.photoURL = newPhotoURL;
        dbUpdates.photoURL = newPhotoURL;
      } else { 
        authUpdates.photoURL = '';
        dbUpdates.photoURL = null;
      }
    }
    
    await updateProfile(auth.currentUser, authUpdates);
    await updateDoc(doc(firestore, 'users', uid), dbUpdates);
    
    return { name, photoURL: authUpdates.photoURL };
}


export function ProfileManager({ currentUser }: { currentUser: AppUser | null }) {
  const [isPending, startTransition] = useTransition();
  const [isPasswordPending, startPasswordTransition] = useTransition();
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(currentUser?.photoURL || null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const { user } = useAppAuth();
  const { toast } = useToast();
  const firestore = useFirestore();
  const auth = useAuth();
  const storage = getStorage();

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: currentUser?.name || '',
    },
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });

  useEffect(() => {
    if (currentUser) {
      profileForm.reset({ name: currentUser.name || '' });
      setImagePreviewUrl(currentUser.photoURL);
    }
  }, [currentUser, profileForm]);


  const onProfileSubmit = async (values: z.infer<typeof profileSchema>) => {
    startTransition(async () => {
      if (!user || !currentUser) {
        toast({ variant: 'destructive', title: 'Error', description: 'Authentication error.' });
        return;
      }
      try {
        const payload: {
            uid: string;
            name: string;
            image?: string | null;
        } = {
            uid: currentUser.uid,
            name: values.name,
        };

        if (imageDataUrl) {
            payload.image = imageDataUrl;
        } 
        else if (currentUser.photoURL && !imagePreviewUrl) {
            payload.image = null;
        }

        await updateUserProfileAction(firestore, auth, storage, payload);

        toast({ title: 'Success', description: 'Profile updated successfully.' });
      } catch (error) {
      console.error(error);
        const errorMessage = error instanceof Error ? error.message : 'An unexpected response was received from the server.';
        toast({ variant: 'destructive', title: 'Error', description: errorMessage });
      }
    });
  };

  const onPasswordSubmit = async (values: z.infer<typeof passwordSchema>) => {
    startPasswordTransition(async () => {
      if (!user || !user.email) {
        toast({ variant: 'destructive', title: 'Error', description: 'Authentication error.' });
        return;
      }

      try {
        const credential = EmailAuthProvider.credential(user.email, values.currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, values.newPassword);
        toast({ title: 'Success', description: 'Password updated successfully.' });
        passwordForm.reset();
      } catch (error: any) {
      console.error(error);
        let message = 'Failed to update password.';
        if(error.code === 'auth/wrong-password') {
            message = 'Incorrect current password.'
        }
        toast({ variant: 'destructive', title: 'Error', description: message });
      }
    });
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setImagePreviewUrl(result);
        setImageDataUrl(result);
      };
      reader.readAsDataURL(file);
    }
  };

  if (!currentUser) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1">
                <h2 className="text-xl font-semibold">Your Profile</h2>
                <p className="text-sm text-muted-foreground">Update your personal details here.</p>
            </div>
            <div className="md:col-span-2 space-y-6">
                <Card>
                    <CardHeader><CardTitle>Profile Information</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-24" />
                            <div className="flex items-center gap-4"><Skeleton className="h-20 w-20 rounded-full" /><Skeleton className="h-10 w-24" /></div>
                        </div>
                        <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
                        <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
                        <Skeleton className="h-10 w-32" />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Change Password</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
                        <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
                        <Skeleton className="h-10 w-36" />
                    </CardContent>
                </Card>
            </div>
        </div>
      );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div className="md:col-span-1">
        <h2 className="text-xl font-semibold">Your Profile</h2>
        <p className="text-sm text-muted-foreground">Update your personal details here.</p>
      </div>
      <div className="md:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...profileForm}>
              <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
                <FormItem>
                  <FormLabel>Profile Picture</FormLabel>
                  <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={imagePreviewUrl || ''} />
                      <AvatarFallback>
                        <User className="h-10 w-10" />
                      </AvatarFallback>
                    </Avatar>
                     <Button asChild variant="outline">
                        <label htmlFor="pfp-upload" className="cursor-pointer">
                            <Upload className="mr-2 h-4 w-4"/>
                            Upload
                            <input id="pfp-upload" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                        </label>
                    </Button>
                     {imagePreviewUrl && (
                        <Button variant="ghost" onClick={() => { setImagePreviewUrl(null); setImageDataUrl(null); }}>Remove</Button>
                    )}
                  </div>
                </FormItem>

                <FormField
                  control={profileForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <Input value={currentUser.email || ''} disabled />
                  <FormDescription>You cannot change your email address.</FormDescription>
                </FormItem>
                
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                <FormField
                  control={passwordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password</FormLabel>
                      <FormControl><Input type="password" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl><Input type="password" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isPasswordPending}>
                    {isPasswordPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Update Password
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
