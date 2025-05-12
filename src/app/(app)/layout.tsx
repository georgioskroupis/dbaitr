import type { ReactNode } from 'react';
import Link from 'next/link';
import { Home, PlusSquare } from 'lucide-react'; 
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


export default function AppLayout({ children }: { children: ReactNode }) {
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
          {children}
        </main>
         <footer className="border-t py-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} db8 - AI Powered Debates
        </footer>
      </SidebarInset>
    </SidebarProvider>
  );
}
