import { useState } from 'react';
import { useApi } from '../useApi.js';
import { date, maskAccount } from '../format.js';
import { Card, ClaimsTable, ErrorBanner, Loading, Notice, PageHeader, Tabs } from '../components/ui.jsx';

export default function Payments() {
  const [tab, setTab] = useState('queue');
  const queue = useApi('/payments/queue');
  const history = useApi('/payments/history');
  const current = tab === 'queue' ? queue : history;

  return (
    <>
      <PageHeader title="Payments" subtitle="Disburse approved claims to employees' bank accounts" />
      <Tabs
        tabs={[{ value: 'queue', label: 'Waiting for payment' }, { value: 'history', label: 'Paid' }]}
        value={tab}
        onChange={setTab}
      />
      <ErrorBanner error={current.error} />
      {tab === 'queue' && (
        <Notice>
          Claims you filed or approved yourself are not listed: the same person may not approve and pay a claim.
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
                ? { header: 'Pay to', cell: (c) => <span className="whitespace-nowrap text-xs text-slate-600">{maskAccount(c.bank_account_no)} · {c.ifsc_code}</span> }
                : { header: 'Paid', cell: (c) => <span className="whitespace-nowrap text-xs text-slate-600">{date(c.payment_date)} · {c.payment_ref}</span> }
            }
          />
        )}
      </Card>
    </>
  );
}
