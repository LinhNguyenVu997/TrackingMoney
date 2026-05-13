import { Inter, JetBrains_Mono } from 'next/font/google';
import { Providers } from './providers';
import { Toaster } from '@/components/ui/sonner';
import { SiteHeader } from '@/components/site-header';
import { RealtimeAlerts } from '@/components/realtime-alerts';
import { DepositNotifier } from '@/components/deposit-notifier';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <Providers>
          <SiteHeader />
          {children}
          <RealtimeAlerts />
          <DepositNotifier />
        </Providers>
        <Toaster />
      </body>
    </html>
  );
}
