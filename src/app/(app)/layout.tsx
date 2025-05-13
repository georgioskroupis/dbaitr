
"use client"; 

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Home, PlusSquare, Loader2 } from 'lucide-react'; 
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar'; 
import { UserNav } from '@/components/layout/UserNav';
import { Logo } from '@/components/layout/Logo';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation'; 
import { useEffect } from 'react';
import { Toaster } from '@/components/ui/toaster'; 
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; 
import { Button } from '@/components/ui/button'; 

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, isSuspended, kycVerified } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!authLoading) {
      if (isSuspended) {
        if (pathname !== '/verify-identity' && pathname !== '/account-suspended') {
          router.replace('/account-suspended');
        }
      } else if (user && !kycVerified && pathname === '/account-suspended') {
        router.replace('/verify-identity');
      } else if (user && kycVerified && pathname === '/account-suspended') {
        router.replace('/dashboard');
      }
    }
  }, [authLoading, user, isSuspended, kycVerified, router, pathname]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-white/80">
        <Loader2 className="h-12 w-12 animate-spin text-rose-500" />
        <p className="mt-4 text-lg">Loading your db8 experience...</p>
      </div>
    );
  }
  
  const showSuspensionBanner = isSuspended && pathname !== '/account-suspended' && pathname !== '/verify-identity';


  return (
    <SidebarProvider defaultOpen>
      <Sidebar variant="sidebar" collapsible="icon" className="bg-black/60 border-r border-white/10 backdrop-blur-lg">
        <SidebarHeader className="p-4">
          <Logo width={100} /> 
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Dashboard" className="text-white/80 hover:bg-white/10 hover:text-white data-[active=true]:bg-rose-500/20 data-[active=true]:text-rose-300">
                <Link href="/dashboard"><Home /> <span>Dashboard</span></Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="New Debate Topic" className="text-white/80 hover:bg-white/10 hover:text-white data-[active=true]:bg-rose-500/20 data-[active=true]:text-rose-300">
                <Link href="/topics/new"><PlusSquare /> <span>New Topic</span></Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-4">
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-white/10 bg-black/50 px-4 shadow-sm backdrop-blur-md md:px-6">
          <div className="flex items-center gap-4">
            <SidebarTrigger className="md:hidden text-white/80 hover:text-white" /> 
            <div className="hidden md:block">
             <Logo width={80}/>
            </div>
          </div>
          
          <div className="flex flex-1 items-center justify-end gap-4">
            <UserNav />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8 bg-black text-white"> {/* Ensure main content area also has dark background and light text */}
          {showSuspensionBanner && (
            <Alert variant="destructive" className="mb-6 bg-red-900/50 border-red-700 text-red-200">
              <AlertTitle className="font-semibold">Account Access Restricted</AlertTitle>
              <AlertDescription>
                Your identity verification is overdue. Please complete it to restore full access.
                <Button variant="link" asChild className="p-0 ml-2 text-rose-300 hover:text-rose-200 underline">
                  <Link href="/verify-identity">Verify Identity Now</Link>
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {children}
        </main>
         <footer className="border-t border-white/10 py-4 text-center text-sm text-white/50 bg-black/80 backdrop-blur-sm">
          © {new Date().getFullYear()} db8 - AI Powered Debates
        </footer>
      </SidebarInset>
    </SidebarProvider>
  );
}
