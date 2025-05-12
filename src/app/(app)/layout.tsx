import type { ReactNode } from 'react';
import Link from 'next/link';
import { Home, PlusSquare, Settings, LogOut, BotMessageSquare, Search as SearchIcon } from 'lucide-react';
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
} from '@/components/ui/sidebar'; // Assuming this is the custom sidebar component from user's files
import { UserNav } from '@/components/layout/UserNav';
import { Logo } from '@/components/layout/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider defaultOpen>
      <Sidebar variant="sidebar" collapsible="icon">
        <SidebarHeader className="p-4">
          <Logo showText={false} iconSize={8}/>
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
           {/* For now, UserNav in header handles logout */}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background/80 px-4 shadow-sm backdrop-blur-md md:px-6">
          <div className="flex items-center gap-4">
            <SidebarTrigger className="md:hidden" /> {/* Mobile trigger */}
            <div className="hidden md:block">
             <Logo iconSize={6} textSize="text-xl"/>
            </div>
          </div>
          
          <div className="flex flex-1 items-center justify-end gap-4">
            {/* Optional: Global search
            <form className="ml-auto flex-1 sm:flex-initial">
              <div className="relative">
                <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search topics..."
                  className="pl-8 sm:w-[300px] md:w-[200px] lg:w-[300px]"
                />
              </div>
            </form>
            */}
            <UserNav />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          {children}
        </main>
         <footer className="border-t py-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} ArguMate - AI Powered Debates
        </footer>
      </SidebarInset>
    </SidebarProvider>
  );
}
