import { useState } from 'react';
import { useApi } from '../useApi.js';
import { Card, ClaimsTable, ErrorBanner, LinkButton, Loading, PageHeader, Tabs } from '../components/ui.jsx';

const FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PAID', label: 'Paid' },
  { value: 'REJECTED', label: 'Rejected' },
];

export default function MyClaims() {
  const { data, error, loading } = useApi('/claims/mine');
  const [filter, setFilter] = useState('ALL');
  const claims = (data?.claims ?? []).filter((c) => filter === 'ALL' || c.status === filter);

  return (
    <>
      <PageHeader
        title="My claims"
        subtitle="Every claim you have submitted, newest first"
        actions={<LinkButton to="/claims/new">New claim</LinkButton>}
      />
      <ErrorBanner error={error} />
      <Tabs tabs={FILTERS} value={filter} onChange={setFilter} />
      <Card>{loading ? <Loading /> : <ClaimsTable claims={claims} />}</Card>
    </>
  );
}
