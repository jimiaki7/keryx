import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { ImportAnalyzer } from './import-analyzer';

export const metadata: Metadata = { title: 'インポート' };

export default function ImportPage() {
  return (
    <>
      <div className="mb-6">
        <Link href="/settings" className="text-sm text-ink-muted hover:text-ink">
          ← 設定
        </Link>
        <PageHeader
          title="Spreadsheet からのインポート"
          description="年間説教プランナー（v1.3.1）の台帳を解析し、取り込み内容を事前に確認します。元のファイルは変更されません。"
        />
      </div>
      <ImportAnalyzer />
    </>
  );
}
