"use client";

import { Sheet, SheetContent } from '@/components/ui/sheet';
import { SearchBar } from '@/components/search/SearchBar';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchBottomSheet({ open, onOpenChange }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="p-4 pb-6 border-t border-border bg-background/95 backdrop-blur-md">
        <div className="max-w-md mx-auto w-full">
          <SearchBar size="default" suggestionsPlacement="up" placeholder="What's the debate?" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
