"use client";

import { withAppCheckHeaders } from '@/lib/appcheck/header';

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  const hdrInit = await withAppCheckHeaders(init);
  return fetch(input, hdrInit);
}

