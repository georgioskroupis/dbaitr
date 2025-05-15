
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { UserProfile } from "@/types";
import { ShieldAlert, ShieldCheck, AlertCircle } from "lucide-react";
import React from "react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getAuthorStatusBadge(profile: UserProfile | null): { label: string; variant: string; icon: JSX.Element } | null {
  if (!profile) return null;

  if (profile.kycVerified) {
    // If KYC verified, no badge is typically shown, but you could add one if needed.
    // For now, returning null means no badge for verified users.
    // return { label: "Verified", variant: "outline", icon: <ShieldCheck className="h-3 w-3 mr-1 text-green-500" /> };
    return null; 
  }

  // Check for suspension if not KYC verified
  if (profile.registeredAt) {
    try {
      const registeredDate = new Date(profile.registeredAt);
      if (isNaN(registeredDate.getTime())) { // Invalid date
         return { label: "Unverified", variant: "outline", icon: <ShieldAlert className="h-3 w-3 mr-1 text-yellow-500" /> };
      }
      const gracePeriodEndDate = new Date(new Date(profile.registeredAt).setDate(new Date(profile.registeredAt).getDate() + 10));
      const now = new Date();
      if (now > gracePeriodEndDate) {
        return { label: "Suspended", variant: "destructive", icon: <AlertCircle className="h-3 w-3 mr-1" /> };
      }
    } catch (e) {
      console.error("Error calculating suspension for badge:", e);
      // Fallback to unverified if date parsing fails
      return { label: "Unverified", variant: "outline", icon: <ShieldAlert className="h-3 w-3 mr-1 text-yellow-500" /> };
    }
  }
  // Default to Unverified if not KYC verified and not past grace period (or no registeredAt)
  return { label: "Unverified", variant: "outline", icon: <ShieldAlert className="h-3 w-3 mr-1 text-yellow-500" /> };
}

// Debounce function to limit how often a function is called.
export function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeout: NodeJS.Timeout | null = null;

  const debounced = (...args: Parameters<F>) => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
    timeout = setTimeout(() => func(...args), waitFor);
  };

  // This assertion is to help TypeScript understand the debounced function's signature.
  return debounced as (...args: Parameters<F>) => void;
}

export function highlightSemanticMatches(
  title: string,
  matches: string[] | undefined // Allow matches to be undefined
): React.ReactNode[] {
  if (!matches || matches.length === 0) {
    return [<span key="title-full">{title}</span>];
  }
  // Create a regex that finds any of the match terms, case insensitively.
  // Escape special characters in matches to prevent regex errors.
  const escapedMatches = matches.map(match => match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escapedMatches.join("|")})`, "gi");
  
  return title.split(regex).map((part, i) => {
    // Check if the current part is one of the matches (case-insensitive)
    const isMatch = escapedMatches.some(
      (escapedMatch) => part.toLowerCase() === escapedMatch.toLowerCase().replace(/\\/g, '') // Compare with unescaped match
    );
    return isMatch ? (
      <span key={`match-${i}`} className="text-primary font-semibold">{part}</span> // Use text-primary for themed red
    ) : (
      <span key={`part-${i}`}>{part}</span>
    );
  });
}
