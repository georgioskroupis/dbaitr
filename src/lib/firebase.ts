"use client";
// Backward-compatible re-exports from the new client singleton
import { getClientApp, getAuthClient, getDbClient, getStorageClient, getRtdbClient } from '@/lib/firebase/client';

const app = getClientApp();
const auth = getAuthClient();
const db = getDbClient();
const storage = getStorageClient();
const rtdb = getRtdbClient();

export { app, auth, db, storage, rtdb };
