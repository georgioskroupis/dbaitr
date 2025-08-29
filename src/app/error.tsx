"use client";

import * as React from 'react';

export default function GlobalError({ error, reset }: { error: any; reset: () => void }) {
  React.useEffect(() => {
    // Log the actual runtime error — helpful when the dev overlay hides it
    // eslint-disable-next-line no-console
    console.error('[GlobalError boundary] \nmessage:', error?.message, '\nstack:', error?.stack, '\nraw:', error);
  }, [error]);

  return (
    <html>
      <body className="min-h-screen bg-black text-white">
        <div className="container mx-auto px-4 py-10">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="mt-2 text-white/80">We captured the error in the console to help debug the root cause.</p>
          {error?.message && (
            <pre className="mt-4 whitespace-pre-wrap rounded-md bg-white/5 p-3 border border-white/10 text-sm">
              {String(error.message)}
            </pre>
          )}
          <div className="mt-4 flex gap-2">
            <button
              className="px-3 py-1.5 rounded-md bg-rose-500 hover:bg-rose-400"
              onClick={() => reset()}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

