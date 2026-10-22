import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, money } from '../api.js';
import { useLoad } from '../useLoad.js';
import { Button, Card, ErrorBox, Field, StatusBadge, Table, Td, Textarea } from '../components/ui.jsx';

const DETAIL_LABELS = {
  travel_from: 'From', travel_to: 'To', distance_km: 'Distance (km)',
  hospital_name: 'Hospital', treatment_type: 'Treatment',
  purpose: 'Purpose', client_name: 'Client',
};

export default function ClaimDetail({ user }) {
  const { id } = useParams();
  const { data: claim, error: loadError, reload } = useLoad(`/claims/${id}`);
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const act = async (path, body) => {
    setError('');
    try {
      await api(`/claims/${id}/${path}`, { method: 'POST', body });
      reload();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loadError) return <ErrorBox error={loadError} />;
  if (!claim) return null;

  const own = claim.applicant_id === user.id;
  const canDecide = user.is_manager && !own && claim.status === 'SUBMITTED';
  const canPay = user.is_manager && !own && claim.status === 'APPROVED';

  return (
    <>
      <Card title={`Claim #${claim.reimbursement_id} · ${claim.claim_type}`} actions={<StatusBadge status={claim.status} />}>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <Info label="Applicant">{claim.applicant_name} ({claim.dept_name})</Info>
          <Info label="Claim date">{claim.claim_date}</Info>
          <Info label="Total">{money(claim.total_amount)}</Info>
          <Info label="Items">{claim.item_count}</Info>
          {Object.entries(claim.details)
            .filter(([k]) => k !== 'reimbursement_id')
            .map(([k, v]) => <Info key={k} label={DETAIL_LABELS[k] ?? k}>{v ?? '—'}</Info>)}
          {claim.approved_by && (
            <>
              <Info label="Decided by">{claim.approver_name}</Info>
              <Info label="Decision date">{claim.approval_date}</Info>
              <Info label="Remarks">{claim.remarks ?? '—'}</Info>
            </>
          )}
        </dl>
      </Card>

      <Card title="Expense items">
        <Table headers={['No', 'Date', 'Category', 'Description', 'Amount', 'Receipt']}>
          {claim.items.map((it) => (
            <tr key={it.item_no}>
              <Td>{it.item_no}</Td>
              <Td>{it.expense_date}</Td>
              <Td>{it.category}</Td>
              <Td>{it.description}</Td>
              <Td>{money(it.amount)}</Td>
              <Td>{it.receipt_path ? <a className="text-blue-700 underline" href={it.receipt_path} target="_blank" rel="noreferrer">view</a> : '—'}</Td>
            </tr>
          ))}
        </Table>
      </Card>

      {(canDecide || canPay) && (
        <Card title={canDecide ? 'Decision' : 'Payment'}>
          <ErrorBox error={error} />
          {canDecide && (
            <div className="space-y-3">
              <Field label="Remarks (required to reject)"><Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} /></Field>
              <div className="flex gap-2">
                <Button variant="success" onClick={() => act('decision', { decision: 'APPROVED', remarks })}>Approve</Button>
                <Button variant="danger" onClick={() => act('decision', { decision: 'REJECTED', remarks })}>Reject</Button>
              </div>
              <p className="text-xs text-gray-500">Your approval limit: {money(user.approval_limit)}</p>
            </div>
          )}
          {canPay && <Button onClick={() => act('pay')}>Mark as paid</Button>}
        </Card>
      )}

      <button onClick={() => navigate(-1)} className="text-sm text-blue-700 underline">Back</button>
    </>
  );
}

function Info({ label, children }) {
  return (
    <div>
      <dt className="text-gray-500">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
