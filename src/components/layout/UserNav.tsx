
"use client";

import { signOut } from "firebase/auth";
import { LogOut, User as UserIcon, ShieldCheck, ShieldAlert, LogIn, UserPlus, Award, Loader2 as NavLoader } from "lucide-react"; 
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
      router.push("/"); 
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
        <NavLoader className="h-5 w-5 animate-spin text-rose-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <Button asChild className="text-sm border border-white/30 hover:border-white rounded-full px-4 py-1 bg-black/30 backdrop-blur-md text-white hover:bg-white/10 transition">
        <Link href="/auth">
          <Award className="mr-2 h-4 w-4" />
          Get Certified
        </Link>
      </Button>
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
          <Avatar className="h-10 w-10 border-2 border-rose-500/50 hover:border-rose-500 transition-colors">
            <AvatarImage src={userProfile?.photoURL || user.photoURL || undefined} alt={displayNameForAvatar || "User"} />
            <AvatarFallback className="bg-rose-500/20 text-rose-500 font-semibold">
              {getInitials(displayNameForAvatar)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 bg-black/70 backdrop-blur-md border-white/20 text-white" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none truncate">{displayNameForAvatar || "User"}</p>
            <p className="text-xs leading-none text-white/70 truncate">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/20" />
        <DropdownMenuGroup>
          <Link href="/verify-identity" passHref>
            <DropdownMenuItem disabled={kycVerified} className="focus:bg-white/10 focus:text-white">
              {kycVerified ? <ShieldCheck className="mr-2 h-4 w-4 text-green-400" /> : <ShieldAlert className="mr-2 h-4 w-4 text-yellow-400" />}
              <span>{kycVerified ? "KYC Verified" : "Verify Identity"}</span>
            </DropdownMenuItem>
          </Link>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="bg-white/20" />
        <DropdownMenuItem onClick={handleSignOut} className="text-rose-400 focus:bg-rose-500/20 focus:text-rose-300">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
