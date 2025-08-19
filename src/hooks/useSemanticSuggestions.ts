"use client";

import { useCallback, useRef, useState } from 'react';
import { debounce } from '@/lib/utils';
import { logger } from '@/lib/logger';
import type { SimilarTopicSuggestion } from '@/ai/flows/find-similar-topics';
import { useToast } from '@/hooks/use-toast';

interface Options {
  minChars?: number;
  debounceMs?: number;
  disabled?: boolean;
  debug?: boolean;
}

export function useSemanticSuggestions(options: Options = {}) {
  const { minChars = 1, debounceMs = 300, disabled = false, debug = process.env.NODE_ENV !== 'production' } = options;

  const [suggestions, setSuggestions] = useState<SimilarTopicSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState("");
  const lastFetchId = useRef<string | null>(null);
  const lastToastAtRef = useRef<number>(0);
  const { toast } = useToast();

  const maybeToast = useCallback((title: string, description?: string) => {
    const now = Date.now();
    if (now - lastToastAtRef.current < 4000) return; // throttle toasts to once per 4s
    lastToastAtRef.current = now;
    toast({ title, description, variant: 'destructive' });
  }, [toast]);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (disabled) return;
    setQuery(q);
    if (!q.trim() || q.length < minChars) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    const fetchId = Math.random().toString(36).slice(2);
    lastFetchId.current = fetchId;
    if (debug) logger.debug(`[SemanticSuggestions-${fetchId}] -> fetching for "${q}"`);
    setIsLoading(true);

    try {
      const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`);
      if (!res.ok) {
        let serverError = '';
        try {
          const data = await res.json();
          if (data?.error) serverError = String(data.error);
        } catch {}
        if (res.status === 429) {
          if (!disabled) maybeToast('You are typing too fast', 'Autocomplete temporarily rate-limited. Please pause briefly.');
        } else {
          const desc = `Server responded with ${res.status}${serverError ? ` – ${serverError}` : ''}.`;
          maybeToast('Suggestions unavailable', desc);
        }
        throw new Error(`HTTP ${res.status}${serverError ? ` – ${serverError}` : ''}`);
      }
      const result = (await res.json()) as { suggestions: SimilarTopicSuggestion[] };
      if (lastFetchId.current !== fetchId) {
        if (debug) logger.debug(`[SemanticSuggestions-${fetchId}] Stale response for "${q}", ignoring.`);
        return;
      }
      const unique = Array.from(new Map(result.suggestions.map((s) => [s.title, s])).values());
      if (debug) logger.debug(`[SemanticSuggestions-${fetchId}] <- results for "${q}":`, unique.map((s) => s.title));
      if (unique.length === 0 && debug && q.trim().length >= minChars) {
        maybeToast('No suggestions returned', 'If this persists, verify AI API key and that topics exist.');
      }
      setSuggestions(unique);
    } catch (err) {
      logger.error('[useSemanticSuggestions] Failed to fetch suggestions:', err);
      setSuggestions([]);
      if (!disabled) maybeToast('Autocomplete error', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      if (lastFetchId.current === fetchId) setIsLoading(false);
    }
  }, [minChars, disabled, debug]);

  const debouncedFetchSuggestions = useCallback(debounce(fetchSuggestions, debounceMs), [fetchSuggestions, debounceMs]);

  const clear = useCallback(() => {
    lastFetchId.current = null;
    setSuggestions([]);
    setIsLoading(false);
    // Cancel any pending debounced call by invoking it with an empty string
    // Our fetchSuggestions early-returns on empty input and will not toast.
    try { (debouncedFetchSuggestions as any)(''); } catch {}
  }, []);

  return { suggestions, loading: isLoading, query, debouncedFetchSuggestions, clear };
}
