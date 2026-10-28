import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDate, humanize, money } from '../api.js';
import { useLoad } from '../useLoad.js';
import Icon from '../components/Icon.jsx';
import {
  ButtonLink,
  Card,
  ErrorBox,
  PageHeader,
  SearchInput,
  StatGrid,
  StatusBadge,
  Table,
  Td,
} from '../components/ui.jsx';

const FILTERS = [
  ['ALL', 'All claims'],
  ['SUBMITTED', 'Pending'],
  ['APPROVED', 'Approved'],
  ['PAID', 'Paid'],
  ['REJECTED', 'Rejected'],
];

export default function MyClaims() {
  const { data: claims, error, loading } = useLoad('/claims');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const rows = claims ?? [];
  const filtered = rows.filter(
    (claim) =>
      (status === 'ALL' || claim.status === status) &&
      [claim.reimbursement_id, claim.claim_type, claim.remarks, claim.approver_name]
        .join(' ')
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const total = rows
    .filter((claim) => claim.status !== 'REJECTED')
    .reduce((sum, claim) => sum + Number(claim.total_amount), 0);
  const paid = rows
    .filter((claim) => claim.status === 'PAID')
    .reduce((sum, claim) => sum + Number(claim.total_amount), 0);

  return (
    <>
      <PageHeader
        eyebrow="PERSONAL EXPENSES"
        title="My claims"
        description="Every expense, every update. All in one place."
        actions={
          <ButtonLink to="/claims/new">
            <Icon name="plus" size={17} />
            New claim
          </ButtonLink>
        }
      />
      <StatGrid
        items={[
          {
            label: 'Total claimed',
            value: claims && money(total),
            detail: 'Excluding rejected claims',
            icon: 'wallet',
          },
          {
            label: 'Pending review',
            value: claims && rows.filter((claim) => claim.status === 'SUBMITTED').length,
            detail: 'Waiting for a manager',
            icon: 'clock',
            tone: 'amber',
          },
          {
            label: 'Approved claims',
            value: claims && rows.filter((claim) => claim.status === 'APPROVED').length,
            detail: 'Ready for reimbursement',
            icon: 'approvals',
            tone: 'blue',
          },
          {
            label: 'Reimbursed',
            value: claims && money(paid),
            detail: 'Successfully marked as paid',
            icon: 'check',
          },
        ]}
      />
      <Card
        title="Claim history"
        description="A complete record of your reimbursements"
        actions={<span className="tag">{rows.length} claims</span>}
      >
        <ErrorBox error={error} />
        <div className="table-toolbar">
          <SearchInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search claims..."
          />
          <div className="filter-tabs" role="group" aria-label="Filter by claim status">
            {FILTERS.map(([value, text]) => (
              <button
                key={value}
                className={status === value ? 'active' : ''}
                aria-pressed={status === value}
                onClick={() => setStatus(value)}
              >
                {text}
              </button>
            ))}
          </div>
        </div>
        <Table
          loading={loading && !claims}
          headers={['Claim', 'Submitted', 'Type', 'Items', 'Amount', 'Status', 'Reviewed by', 'Remarks']}
          empty={rows.length ? 'No claims match your filters.' : 'Your first claim starts here.'}
        >
          {filtered.map((claim) => (
            <tr key={claim.reimbursement_id}>
              <Td>
                <Link className="record-link" to={`/claims/${claim.reimbursement_id}`}>
                  CLM-{String(claim.reimbursement_id).padStart(3, '0')}
                </Link>
              </Td>
              <Td className="whitespace-nowrap">{formatDate(claim.claim_date)}</Td>
              <Td>
                <span className="tag">{humanize(claim.claim_type)}</span>
              </Td>
              <Td>{claim.item_count}</Td>
              <Td className="amount">{money(claim.total_amount)}</Td>
              <Td>
                <StatusBadge status={claim.status} />
              </Td>
              <Td>{claim.approver_name ?? 'Awaiting review'}</Td>
              <Td className="max-w-52">{claim.remarks || '-'}</Td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
