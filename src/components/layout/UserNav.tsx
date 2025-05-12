
"use client";

import { signOut } from "firebase/auth";
import { LogOut, User as UserIcon, ShieldCheck, ShieldAlert } from "lucide-react";
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
  const { user, userProfile, kycVerified } = useAuth(); // Changed isVerified to kycVerified
  const router = useRouter();
  const { toast } = useToast();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      toast({ title: "Signed out successfully." });
      router.push("/sign-in");
    } catch (error) {
      console.error("Sign out error:", error);
      toast({ title: "Sign out failed.", variant: "destructive" });
    }
  };

  if (!user) return null;

  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    return name.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';
  }

  // Firebase Auth User still has displayName, UserProfile has fullName
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
            <p className="text-sm font-medium leading-none">{displayNameForAvatar || "User"}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <Link href="/verify-identity" passHref>
            <DropdownMenuItem disabled={kycVerified}> {/* Changed isVerified to kycVerified */}
              {kycVerified ? <ShieldCheck className="mr-2 h-4 w-4 text-green-500" /> : <ShieldAlert className="mr-2 h-4 w-4 text-yellow-500" />}
              <span>{kycVerified ? "Verified" : "Verify ID"}</span> {/* Changed isVerified to kycVerified */}
            </DropdownMenuItem>
          </Link>
          {/* Add more items like Profile, Settings here if needed */}
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
