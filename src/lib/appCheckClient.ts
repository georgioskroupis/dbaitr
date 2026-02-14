"use client";

import type { AppCheck } from 'firebase/app-check';
import { ensureAppCheck } from '@/lib/firebase/client';

export function getAppCheckInstance(): AppCheck | null {
  return ensureAppCheck();
}

export function initAppCheckIfConfigured() {
  ensureAppCheck();
}
