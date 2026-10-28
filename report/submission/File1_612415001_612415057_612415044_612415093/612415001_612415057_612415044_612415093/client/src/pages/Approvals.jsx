import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDate, humanize, money } from '../api.js';
import { useLoad } from '../useLoad.js';
import {
  Avatar,
  Card,
  ErrorBox,
  Notice,
  PageHeader,
  SearchInput,
  StatGrid,
  Table,
  Td,
} from '../components/ui.jsx';

export default function Approvals({ user }) {
  const { data: claims, error, loading } = useLoad('/manager/approvals');
  const [search, setSearch] = useState('');
  const rows = claims ?? [];
  const filtered = rows.filter((claim) =>
    [claim.reimbursement_id, claim.applicant_name, claim.dept_name, claim.claim_type]
      .join(' ')
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <>
      <PageHeader
        eyebrow="MANAGER WORKSPACE"
        title="Approvals"
        description="A little attention here keeps your team's expenses moving."
      />
      <StatGrid
        items={[
          {
            label: 'Awaiting your review',
            value: claims && rows.length,
            detail: 'Eligible submitted claims',
            icon: 'approvals',
            tone: 'amber',
          },
          {
            label: 'In your queue',
            value: claims && money(rows.reduce((sum, claim) => sum + Number(claim.total_amount), 0)),
            detail: 'Combined claim value',
            icon: 'wallet',
          },
          {
            label: 'Your approval limit',
            value: money(user.approval_limit),
            detail: 'Maximum per claim',
            icon: 'shield',
            tone: 'blue',
          },
          {
            label: 'Departments',
            value: claims && new Set(rows.map((claim) => claim.dept_name)).size,
            detail: 'Represented in this queue',
            icon: 'building',
            tone: 'purple',
          },
        ]}
      />
      <Card
        title="Your review queue"
        description="Open a claim to review its expenses and make a decision"
        actions={<span className="tag">{rows.length} pending</span>}
      >
        <ErrorBox error={error} />
        <Notice>
          This queue includes claims within your approval limit and excludes your own submissions.
        </Notice>
        <div className="table-toolbar">
          <SearchInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search applicant, claim or department..."
          />
          <span className="table-meta">{filtered.length} claims in view</span>
        </div>
        <Table
          loading={loading && !claims}
          headers={['Claim', 'Submitted', 'Applicant', 'Department', 'Type', 'Items', 'Amount', '']}
          empty="You're all caught up."
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
                <span className="person-cell">
                  <Avatar name={claim.applicant_name} small />
                  <strong>{claim.applicant_name}</strong>
                </span>
              </Td>
              <Td>{claim.dept_name}</Td>
              <Td>
                <span className="tag">{humanize(claim.claim_type)}</span>
              </Td>
              <Td>{claim.item_count}</Td>
              <Td className="amount">{money(claim.total_amount)}</Td>
              <Td>
                <Link className="record-link" to={`/claims/${claim.reimbursement_id}`}>
                  Review claim
                </Link>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
