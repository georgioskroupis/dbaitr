
import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/context/AuthContext';
import QueryProvider from '@/context/QueryProvider';
import AppBootstrapper from '@/components/AppBootstrapper'; // Import the AppBootstrapper

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-poppins',
});

const LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/db8app.firebasestorage.app/o/db8-logo.png?alt=media&token=ccea3f69-32c3-4960-9b5f-afa56e963347";
const FAVICON_URL = "https://firebasestorage.googleapis.com/v0/b/db8app.firebasestorage.app/o/db8-favicon.png?alt=media&token=2c530150-2b60-4715-a385-0c9e9443ac0e";

export const metadata: Metadata = {
  title: 'db8 - AI Powered Debates',
  description: 'Engage in structured debates with AI analysis and KYC verification.',
  icons: {
    icon: [
      { url: FAVICON_URL, type: 'image/png' },
    ],
  },
  openGraph: {
    title: 'db8 - AI Powered Debates',
    description: 'Engage in structured debates with AI analysis and KYC verification.',
    images: [
      {
        url: LOGO_URL, 
        width: 1200,
        height: 630,
        alt: 'db8 Logo',
      },
    ],
    siteName: 'db8',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'db8 - AI Powered Debates',
    description: 'Engage in structured debates with AI analysis and KYC verification.',
    images: [LOGO_URL], 
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
      <body className={`${poppins.variable} antialiased font-sans`}>
        <AppBootstrapper /> {/* Add the AppBootstrapper here */}
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
