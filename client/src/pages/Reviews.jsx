import { useState } from 'react';
import { useApi } from '../useApi.js';
import { money } from '../format.js';
import { Card, Chip, ClaimsTable, ErrorBanner, Loading, Notice, PageHeader, Tabs } from '../components/ui.jsx';

export default function Reviews() {
  const [tab, setTab] = useState('queue');
  const queue = useApi('/reviews/queue');
  const history = useApi('/reviews/history');
  const current = tab === 'queue' ? queue : history;

  return (
    <>
      <PageHeader title="Review queue" subtitle="Approve or reject claims from other employees" />
      <Tabs
        tabs={[{ value: 'queue', label: 'Waiting for review' }, { value: 'history', label: 'Reviewed by me' }]}
        value={tab}
        onChange={setTab}
      />
      <ErrorBanner error={current.error} />
      {tab === 'queue' && queue.data && (
        <Notice>
          Your approval limit is <strong>{money(queue.data.approval_limit)}</strong>. You see claims up to that amount, except your own.
          {queue.data.over_limit > 0 &&
            ` ${queue.data.over_limit} more claim${queue.data.over_limit === 1 ? ' is' : 's are'} above your limit and wait for a senior manager.`}
        </Notice>
      )}
      <Card>
        {current.loading ? (
          <Loading />
        ) : (
          <ClaimsTable
            claims={current.data?.claims ?? []}
            showApplicant
            extra={
              tab === 'queue'
                ? { header: '', cell: (c) => (c.is_subordinate ? <Chip tone="violet">Reports to you</Chip> : null) }
                : undefined
            }
          />
        )}
      </Card>
    </>
  );
}
