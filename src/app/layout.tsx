
import type { Metadata } from 'next';
import './globals.css';
// Self-hosted Fredoka via @fontsource to avoid network fetch during build
import '@fontsource/fredoka/300.css';
import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/context/AuthContext';
import QueryProvider from '@/context/QueryProvider';
import AppBootstrapper from '@/components/AppBootstrapper';

// Define CSS variable in globals.css; using @fontsource-loaded family 'Fredoka'

// Updated Asset URLs (prefer local assets for icons to avoid remote failures)
const DBAITR_SVG_LOGO_URL = "/video-poster.svg";

export const metadata: Metadata = {
  title: 'dbaitr - AI Powered Debates',
  description: 'Engage in structured debates with AI analysis on dbaitr.',
  icons: {
    icon: ['/favicon.ico'],
  },
  openGraph: {
    title: 'dbaitr - AI Powered Debates',
    description: 'Engage in structured debates with AI analysis on dbaitr.',
    images: [
      {
        url: DBAITR_SVG_LOGO_URL, // Use SVG logo for social previews
        width: 1200, // Adjust if SVG inherent size is different or known
        height: 630,  // Adjust for OG aspect ratio
        alt: 'dbaitr Logo',
      },
    ],
    siteName: 'dbaitr',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'dbaitr - AI Powered Debates',
    description: 'Engage in structured debates with AI analysis on dbaitr.',
    images: [DBAITR_SVG_LOGO_URL],
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`antialiased font-sans`}>
        <AppBootstrapper />
        <QueryProvider>
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
