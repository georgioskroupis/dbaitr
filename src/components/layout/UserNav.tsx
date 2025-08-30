
"use client";

import { signOut } from "firebase/auth";
import { LogOut, User as UserIcon, ShieldCheck, ShieldAlert, LogIn, UserPlus, Eye, DollarSign, ScrollText, Loader2 as NavLoader, Shield } from "lucide-react";
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
import { getAuth } from "@/lib/firebase/client";
import { useAuth } from "@/context/AuthContext";
import { logger } from '@/lib/logger';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { BrandTooltip } from '@/components/branding/BrandTooltip';

export function UserNav({ includeMobileExtras = false }: { includeMobileExtras?: boolean } = {}) {
  const { user, userProfile, kycVerified, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const router = useRouter();
  const { toast } = useToast();

  const handleSignOut = async () => {
    try {
      await signOut(getAuth());
      toast({ title: "Signed out successfully." });
      router.push("/");
    } catch (error: any) {
      logger.error("Detailed error: Sign out failed:", error);
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
        <NavLoader className="h-5 w-5 animate-spin text-primary" /> {/* Use primary color */}
      </div>
    );
  }

  if (!user) {
    return (
      <Button asChild className="text-sm border border-primary/50 hover:border-primary rounded-full px-4 py-1 bg-background/30 backdrop-blur-md text-foreground hover:bg-accent/10 transition">
        <Link href="/auth">
          <UserPlus className="mr-2 h-4 w-4 text-primary" />
          Be a <BrandTooltip side="bottom" avoidCollisions collisionPadding={12}><span className="cursor-help inline align-baseline">dbaitr</span></BrandTooltip>
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
        <Button
          className="relative h-10 w-10 rounded-full border border-primary/50 bg-background/30 backdrop-blur-md text-foreground hover:bg-primary/20 hover:text-primary hover:border-primary transition-colors"
        >
          <Avatar className="h-10 w-10 border-2 border-primary/50 hover:border-primary transition-colors">
            <AvatarImage src={userProfile?.photoURL || user.photoURL || undefined} alt={displayNameForAvatar || "User"} />
            <AvatarFallback className="bg-primary/20 text-primary font-semibold">
              {getInitials(displayNameForAvatar)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 bg-card backdrop-blur-md border-border text-foreground" align="end" forceMount> {/* Theme colors */}
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none truncate">{displayNameForAvatar || "User"}</p>
            <p className="text-xs leading-none text-muted-foreground truncate"> {/* Muted text color */}
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border" /> {/* Theme color */}
        <DropdownMenuGroup>
          {!includeMobileExtras && (
            <>
          <Link href="/profile" passHref>
            <DropdownMenuItem className="focus:bg-accent focus:text-accent-foreground">
              <UserIcon className="mr-2 h-4 w-4" />
              <span>My Profile</span>
            </DropdownMenuItem>
          </Link>
              <DropdownMenuSeparator className="bg-border" />
            </>
          )}
          <Link href="/transparency" passHref>
            <DropdownMenuItem className="focus:bg-accent focus:text-accent-foreground">
              <Eye className="mr-2 h-4 w-4" />
              <span>Transparency</span>
            </DropdownMenuItem>
          </Link>
          {isAdmin && (
            <Link href="/admin" passHref>
              <DropdownMenuItem className="focus:bg-accent focus:text-accent-foreground">
                <Shield className="mr-2 h-4 w-4" />
                <span>Admin Panel</span>
              </DropdownMenuItem>
            </Link>
          )}
          {/* Mobile extras: on mobile app pages, include Pricing then Manifesto below Admin */}
          {includeMobileExtras && (
            <>
              <Link href="/pricing" passHref>
                <DropdownMenuItem className="focus:bg-accent focus:text-accent-foreground">
                  <DollarSign className="mr-2 h-4 w-4" />
                  <span>Pricing</span>
                </DropdownMenuItem>
              </Link>
              <Link href="/manifesto" passHref>
                <DropdownMenuItem className="focus:bg-accent focus:text-accent-foreground">
                  <ScrollText className="mr-2 h-4 w-4" />
                  <span>Manifesto</span>
                </DropdownMenuItem>
              </Link>
            </>
          )}
          <DropdownMenuSeparator className="bg-border" />
          {kycVerified ? (
            <DropdownMenuItem
              disabled
              className="group cursor-default focus:bg-accent focus:text-accent-foreground"
            >
              <ShieldCheck className="mr-2 h-4 w-4 text-emerald-500 group-focus:text-accent-foreground" />
              <span>KYC Verified</span>
            </DropdownMenuItem>
          ) : (
            <Link href="/verify-identity" passHref>
              <DropdownMenuItem className="focus:bg-accent focus:text-accent-foreground">
                <ShieldAlert className="mr-2 h-4 w-4" />
                <span>Verify Identity</span>
              </DropdownMenuItem>
            </Link>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="bg-border" /> {/* Theme color */}
        <DropdownMenuItem onClick={handleSignOut} className="focus:bg-accent focus:text-accent-foreground">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
