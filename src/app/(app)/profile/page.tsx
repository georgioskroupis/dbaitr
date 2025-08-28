"use client";

import * as React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { db } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck } from 'lucide-react';

const schema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters.').max(50, 'Please keep names under 50 characters.'),
});

type Values = z.infer<typeof schema>;

export default function ProfilePage() {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: userProfile?.fullName || '' },
  });

  React.useEffect(() => {
    form.reset({ fullName: userProfile?.fullName || '' });
  }, [userProfile?.fullName]);

  const onSubmit = async (values: Values) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        fullName: values.fullName.trim(),
        updatedAt: serverTimestamp(),
      });
      toast({ title: 'Profile updated', description: 'Your name has been saved.' });
    } catch (e: any) {
      toast({ title: 'Update failed', description: e?.message || 'Please try again.', variant: 'destructive' });
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-semibold text-white mb-2">Your Profile</h1>
      <p className="text-white/70 mb-4">Use your real full name for civil, accountable debate.</p>
      {userProfile?.kycVerified && (
        <div className="mb-4">
          <Badge className="bg-emerald-600 hover:bg-emerald-500 text-white"><ShieldCheck className="h-3.5 w-3.5 mr-1" /> Verified</Badge>
        </div>
      )}
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-md">
        <div>
          <Label htmlFor="fullName" className="text-white">Full Name</Label>
          <Input id="fullName" {...form.register('fullName')} placeholder="First Last" className="mt-1 bg-white/5 border-white/20 text-white" />
          <p className="mt-1 text-xs text-white/50">Use your real first and last name.</p>
          {form.formState.errors.fullName && (
            <p className="mt-1 text-sm text-destructive">{form.formState.errors.fullName.message}</p>
          )}
        </div>
        <Button type="submit" className="bg-rose-500 hover:bg-rose-400">Save</Button>
      </form>
    </div>
  );
}
