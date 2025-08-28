import React from "react";
import { logger } from '@/lib/logger';
import type { UserProfile } from "@/types";
import { ShieldAlert, ShieldCheck, AlertCircle } from "lucide-react";

export function getAuthorStatusBadge(
  profile: UserProfile | null
): { label: string; variant: string; icon: JSX.Element } | null {
  if (!profile) return null;

  if (profile.kycVerified) {
    return {
      label: "Verified",
      variant: "default",
      icon: <ShieldCheck className="h-3 w-3 mr-1 text-emerald-400" />,
    };
  }

  if (profile.registeredAt) {
    try {
      const registeredDate = new Date(profile.registeredAt);
      if (isNaN(registeredDate.getTime())) {
        return {
          label: "Unverified",
          variant: "outline",
          icon: <ShieldAlert className="h-3 w-3 mr-1 text-yellow-500" />,
        };
      }
      const gracePeriodEndDate = new Date(
        new Date(profile.registeredAt).setDate(
          new Date(profile.registeredAt).getDate() + 10
        )
      );
      const now = new Date();
      if (now > gracePeriodEndDate) {
        return {
          label: "Suspended",
          variant: "destructive",
          icon: <AlertCircle className="h-3 w-3 mr-1" />,
        };
      }
    } catch (e) {
      logger.error("Error calculating suspension for badge:", e);
      return {
        label: "Unverified",
        variant: "outline",
        icon: <ShieldAlert className="h-3 w-3 mr-1 text-yellow-500" />,
      };
    }
  }
  return {
    label: "Unverified",
    variant: "outline",
    icon: <ShieldAlert className="h-3 w-3 mr-1 text-yellow-500" />,
  };
}

export function highlightSemanticMatches(
  title: string,
  matches: string[] | undefined
): React.ReactNode[] {
  if (!matches || matches.length === 0) {
    return [<span key="title-full">{title}</span>];
  }
  const escapedMatches = matches.map((match) =>
    match.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  const regex = new RegExp(`(${escapedMatches.join("|")})`, "gi");

  return title.split(regex).map((part, i) => {
    const isMatch = escapedMatches.some(
      (escapedMatch) =>
        part.toLowerCase() === escapedMatch.toLowerCase().replace(/\\/g, "")
    );
    return isMatch ? (
      <span key={`match-${i}`} className="text-primary font-semibold">
        {part}
      </span>
    ) : (
      <span key={`part-${i}`}>{part}</span>
    );
  });
}
