import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/context/AuthContext';
import QueryProvider from '@/context/QueryProvider';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'], // Light, Regular, Medium, Bold
  variable: '--font-poppins',
});

export const metadata: Metadata = {
  title: 'db8 - AI Powered Debates',
  description: 'Engage in structured debates with AI analysis and KYC verification.',
  openGraph: {
    title: 'db8 - AI Powered Debates',
    description: 'Engage in structured debates with AI analysis and KYC verification.',
    images: [
      {
        url: '/assets/images/db8-logo.png', // Assumes db8-logo.png is in public/assets/images
        width: 1080, // Actual width of the logo image
        height: 1080, // Actual height of the logo image
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
    images: ['/assets/images/db8-logo.png'], // Assumes db8-logo.png is in public/assets/images
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${poppins.variable} antialiased font-sans`}>
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
