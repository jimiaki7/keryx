import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';

export default function HomePage() {
  return (
    <>
      <PageHeader title="ホーム" description="次の礼拝と説教準備の状況を、ここで見渡せます。" />
      <section aria-label="次の集会">
        <EmptyState
          title="次の Gathering はまだありません"
          description="礼拝予定と説教準備の登録機能は現在準備中です。登録できるようになると、次の主日・聖書箇所・準備の進み具合がここに表示されます。"
        />
      </section>
    </>
  );
}
