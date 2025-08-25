"use client";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <div className="text-center space-y-3">
        <h1 className="text-2xl font-semibold text-white">Page not found</h1>
        <p className="text-white/60 text-sm">The page you are looking for does not exist.</p>
      </div>
    </div>
  );
}

