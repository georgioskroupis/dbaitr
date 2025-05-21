
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

// Updated Asset URLs
const DBAITR_SVG_LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/db8app.firebasestorage.app/o/dbaitr-logo.svg?alt=media&token=4da903b9-22ac-486a-89f3-145bd84bec11";
const DBAITR_SVG_FAVICON_URL = "https://firebasestorage.googleapis.com/v0/b/db8app.firebasestorage.app/o/dbaitr-favicon.svg?alt=media&token=0ede04eb-0397-435e-bea6-6d1a9dc705ae";

export const metadata: Metadata = {
  title: 'dbaitr - AI Powered Debates',
  description: 'Engage in structured debates with AI analysis on dbaitr.',
  icons: {
    icon: [
      { url: DBAITR_SVG_FAVICON_URL, type: 'image/svg+xml' }, // Use SVG favicon
    ],
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
    images: [DBAITR_SVG_LOGO_URL], // Use SVG logo for Twitter cards
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
      <body className={`${fredoka.variable} antialiased font-sans`}>
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
