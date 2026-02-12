"use client";

import * as React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck } from 'lucide-react';
import { apiFetch } from '@/lib/http/client';

const schema = z.object({
  fullName: z.string()
    .trim()
    .min(3, 'Full name must be at least 3 characters.')
    .max(80, 'Please keep names under 80 characters.')
    .refine((v) => v.split(/\s+/).filter(Boolean).length >= 2, 'Please enter first and last name.'),
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
      const res = await apiFetch('/api/users/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: values.fullName.trim().replace(/\s+/g, ' ') }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'server_error');
      }
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
