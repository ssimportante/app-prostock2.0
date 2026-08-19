
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '@/firebase';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '../icons/Logo';
import { Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const formSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});

const defaultUsers = {
    "admin@beanespress.com": "password",
    "stockman@beanespress.com": "password",
    "poc@beanespress.com": "password",
}

export function LoginForm() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const auth = useAuth();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: 'admin@beanespress.com',
      password: '',
    },
  });
  
  const handleUserSelect = (email: string) => {
      form.setValue('email', email);
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    if (!auth) {
        toast({ variant: 'destructive', title: 'Error', description: 'Firebase not initialized.' });
        setLoading(false);
        return;
    }

    try {
      // Try to sign in first
      await signInWithEmailAndPassword(auth, values.email, values.password);
      // The AuthProvider will handle redirection and user doc creation.
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/user-not-found' && Object.keys(defaultUsers).includes(values.email)) {
        // If a default user doesn't exist, create it
        try {
          await createUserWithEmailAndPassword(auth, values.email, values.password);
        } catch (creationError: any) {
      console.error(creationError);
          toast({
            variant: 'destructive',
            title: 'User Creation Failed',
            description: creationError.message,
          });
        }
      } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
          toast({
            variant: 'destructive',
            title: 'Login Failed',
            description: 'Incorrect email or password.',
        });
      }
      else {
        // For any other login error
        toast({
          variant: 'destructive',
          title: 'Login Failed',
          description: error.message || 'An unknown error occurred.',
        });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex items-center gap-2">
            <Logo className="h-10 w-10 text-primary" />
            <h1 className="font-headline text-3xl font-bold text-primary">ProStock</h1>
        </div>
        <CardTitle className="font-headline text-2xl">Login</CardTitle>
        <CardDescription>Enter your credentials to access the dashboard.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                   <Select onValueChange={handleUserSelect} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a pre-configured user" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.keys(defaultUsers).map(email => (
                        <SelectItem key={email} value={email}>{email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                   <FormDescription>
                    Default password for all users is `password`.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
