
"use client"; // Required for hooks like useAuth, useRouter, usePathname

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
import { useRouter, usePathname } from 'next/navigation'; // Import useRouter and usePathname
import { useEffect } from 'react';
import { Toaster } from '@/components/ui/toaster'; // Ensure Toaster is here for AppLayout specific toasts if any
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; // For suspension banner
import { Button } from '@/components/ui/button'; // For suspension banner CTA

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, isSuspended, kycVerified } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!authLoading) {
      if (isSuspended) {
        // Allow access to verification and suspended info page
        if (pathname !== '/verify-identity' && pathname !== '/account-suspended') {
          router.replace('/account-suspended');
        }
      } else if (user && !kycVerified && pathname === '/account-suspended') {
        // If user is not suspended but somehow landed on suspended page (e.g. bookmarked)
        // and is not KYC verified, redirect them to verify identity.
        // If they are KYC verified, they shouldn't be on suspended page.
        router.replace('/verify-identity');
      } else if (user && kycVerified && pathname === '/account-suspended') {
        // If user is KYC verified and on suspended page, redirect to dashboard.
        router.replace('/dashboard');
      }
    }
  }, [authLoading, user, isSuspended, kycVerified, router, pathname]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg">Loading your db8 experience...</p>
      </div>
    );
  }
  
  const showSuspensionBanner = isSuspended && pathname !== '/account-suspended' && pathname !== '/verify-identity';


  return (
    <SidebarProvider defaultOpen>
      <Sidebar variant="sidebar" collapsible="icon">
        <SidebarHeader className="p-4">
          <Logo width={100} /> 
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Dashboard">
                <Link href="/dashboard"><Home /> <span>Dashboard</span></Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="New Debate Topic">
                <Link href="/topics/new"><PlusSquare /> <span>New Topic</span></Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {/* Add more navigation items here */}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-4">
           {/* Example: Settings or Logout could be here */}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background/80 px-4 shadow-sm backdrop-blur-md md:px-6">
          <div className="flex items-center gap-4">
            <SidebarTrigger className="md:hidden" /> {/* Mobile trigger */}
            <div className="hidden md:block">
             <Logo width={80}/>
            </div>
          </div>
          
          <div className="flex flex-1 items-center justify-end gap-4">
            <UserNav />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          {showSuspensionBanner && (
            <Alert variant="destructive" className="mb-6">
              <AlertTitle className="font-semibold">Account Access Restricted</AlertTitle>
              <AlertDescription>
                Your identity verification is overdue. Please complete it to restore full access.
                <Button variant="link" asChild className="p-0 ml-2 text-destructive-foreground hover:text-destructive-foreground/80">
                  <Link href="/verify-identity">Verify Identity Now</Link>
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {children}
        </main>
         <footer className="border-t py-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} db8 - AI Powered Debates
        </footer>
      </SidebarInset>
      {/* Toaster can remain in RootLayout if preferred, or here if specific to AppLayout */}
    </SidebarProvider>
  );
}
