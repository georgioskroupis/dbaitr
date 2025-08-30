export default function Err401() {
  return (
    <div className="container mx-auto py-16 text-center">
      <h1 className="text-3xl text-white font-semibold mb-3">Unauthorized (401)</h1>
      <p className="text-white/70">Your session is missing or expired. Please sign in and try again.</p>
    </div>
  );
}

