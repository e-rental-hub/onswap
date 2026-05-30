import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/hooks/useAuth';
import Script from 'next/script';
import PiInit from '@/lib/PiInit';
import { ThemeProvider } from '@/hooks/useTheme';

export const metadata: Metadata = {
  title: 'Pi P2P — Trade Pi Securely',
  description: 'Peer-to-peer Pi Network trading with escrow protection. Buy and sell Pi using Naira bank transfer.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Script
          src="https://sdk.minepi.com/pi-sdk.js"
          strategy="beforeInteractive"
        />
        <ThemeProvider>
          <AuthProvider>          
            {children}
          </AuthProvider>
        </ThemeProvider>
        
        <PiInit />
      </body>
    </html>
  );
}
