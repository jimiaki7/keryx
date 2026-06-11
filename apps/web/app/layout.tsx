import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Keryx',
  description: '説教計画・礼拝準備・振り返りを一つの流れに統合するワークスペース',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
