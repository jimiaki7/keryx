import type { Metadata, Viewport } from 'next';
import { ServiceWorkerRegister } from '@/components/service-worker-register';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Keryx', template: '%s | Keryx' },
  description: '説教計画・礼拝準備・振り返りを一つの流れに統合するワークスペース',
  applicationName: 'Keryx',
  appleWebApp: { capable: true, title: 'Keryx', statusBarStyle: 'default' },
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#1e2a4a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-dvh antialiased">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
