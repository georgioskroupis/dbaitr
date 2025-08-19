"use client";

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Hash } from 'lucide-react';

interface HeadingAnchorProps {
  id: string;
  children: React.ReactNode;
  className?: string;
  level?: 2 | 3 | 4;
}

export function HeadingAnchor({ id, children, className, level = 2 }: HeadingAnchorProps) {
  const Tag = (`h${level}` as unknown) as keyof JSX.IntrinsicElements;
  return (
    <div className="group relative">
      <Tag id={id} className={cn("scroll-mt-24 flex items-center gap-2", className)}>
        {children}
        <Link
          href={`#${id}`}
          aria-label={`Link to ${children}` as string}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:text-primary/80"
        >
          <Hash className="h-4 w-4" />
        </Link>
      </Tag>
    </div>
  );
}

