
import type { Metadata } from 'next';
import { Fredoka } from 'next/font/google'; // Changed from Poppins to Fredoka
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/context/AuthContext';
import QueryProvider from '@/context/QueryProvider';
import AppBootstrapper from '@/components/AppBootstrapper';

// Setup Fredoka font
const fredoka = Fredoka({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'], // Adjusted weights for Fredoka
  variable: '--font-fredoka', // Changed variable name
});

// Placeholder URLs - these should be updated with actual hosted dbaitr assets
const DBAITR_LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/db8app.firebasestorage.app/o/dbaitr-logo-placeholder.png?alt=media"; // Placeholder
const DBAITR_FAVICON_URL = "https://firebasestorage.googleapis.com/v0/b/db8app.firebasestorage.app/o/dbaitr-gavel-hook-favicon.png?alt=media"; // Placeholder for the gavel-hook favicon

export const metadata: Metadata = {
  title: 'dbaitr - AI Powered Debates', // Changed from db8
  description: 'Engage in structured debates with AI analysis on dbaitr.', // Changed from db8
  icons: {
    icon: [
      { url: DBAITR_FAVICON_URL, type: 'image/png' },
    ],
  },
  openGraph: {
    title: 'dbaitr - AI Powered Debates', // Changed
    description: 'Engage in structured debates with AI analysis on dbaitr.', // Changed
    images: [
      {
        url: DBAITR_LOGO_URL,
        width: 1200,
        height: 630,
        alt: 'dbaitr Logo', // Changed
      },
    ],
    siteName: 'dbaitr', // Changed
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'dbaitr - AI Powered Debates', // Changed
    description: 'Engage in structured debates with AI analysis on dbaitr.', // Changed
    images: [DBAITR_LOGO_URL],
  },
  manifest: '/manifest.json', // Assuming manifest will be updated/created for dbaitr
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${fredoka.variable} antialiased font-sans`}> {/* Use Fredoka variable */}
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
