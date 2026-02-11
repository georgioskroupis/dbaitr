import { notFound } from 'next/navigation';
import DebugToolsClient from './DebugToolsClient';

export default function Page() {
  if (process.env.NODE_ENV === 'production') return notFound();
  return <DebugToolsClient />;
}

