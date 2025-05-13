
"use client";

import { signOut } from "firebase/auth";
import { LogOut, User as UserIcon, ShieldCheck, ShieldAlert, LogIn, UserPlus } from "lucide-react"; // Added LogIn, UserPlus
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { auth } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";

export function UserNav() {
  const { user, userProfile, kycVerified, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      toast({ title: "Signed out successfully." });
      router.push("/sign-in"); // Redirect to sign-in after logout
    } catch (error: any) {
      console.error("Detailed error: Sign out failed:", error);
      toast({ 
        title: "Sign Out Failed", 
        description: `An error occurred during sign out: ${error.message || 'Unknown error'}. Please try again.`,
        variant: "destructive" 
      });
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-10 w-24">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/sign-in">
            <LogIn className="mr-2 h-4 w-4" />
            Sign In
          </Link>
        </Button>
        <Button variant="default" size="sm" asChild>
          <Link href="/sign-up">
            <UserPlus className="mr-2 h-4 w-4" />
            Sign Up
          </Link>
        </Button>
      </div>
    );
  }

  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    const nameParts = name.split(' ').filter(Boolean);
    if (nameParts.length === 0) return "U";
    if (nameParts.length === 1) return nameParts[0][0].toUpperCase();
    return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
  }

  const displayNameForAvatar = userProfile?.fullName || user.displayName;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10 border-2 border-primary/50 hover:border-primary transition-colors">
            <AvatarImage src={userProfile?.photoURL || user.photoURL || undefined} alt={displayNameForAvatar || "User"} />
            <AvatarFallback className="bg-primary/20 text-primary font-semibold">
              {getInitials(displayNameForAvatar)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none truncate">{displayNameForAvatar || "User"}</p>
            <p className="text-xs leading-none text-muted-foreground truncate">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {/* Example item: Link to user profile page if you have one */}
          {/* <Link href="/profile" passHref>
            <DropdownMenuItem>
              <UserIcon className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
          </Link> */}
          <Link href="/verify-identity" passHref>
            <DropdownMenuItem disabled={kycVerified}>
              {kycVerified ? <ShieldCheck className="mr-2 h-4 w-4 text-green-500" /> : <ShieldAlert className="mr-2 h-4 w-4 text-yellow-500" />}
              <span>{kycVerified ? "KYC Verified" : "Verify Identity"}</span>
            </DropdownMenuItem>
          </Link>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Minimal loader for authLoading state
const Loader2 = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
);
