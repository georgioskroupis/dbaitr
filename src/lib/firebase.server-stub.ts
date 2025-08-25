// Server stub for '@/lib/firebase' to prevent browser SDK from loading during SSR/prerender.
function fail(name: string): never {
  throw new Error(`Firebase client SDK '${name}' accessed on the server. Use Admin SDK or API routes instead.`);
}

export const app: any = new Proxy({}, { get: () => fail('app') });
export const auth: any = new Proxy({}, { get: () => fail('auth') });
export const db: any = new Proxy({}, { get: () => fail('firestore') });
export const storage: any = new Proxy({}, { get: () => fail('storage') });

