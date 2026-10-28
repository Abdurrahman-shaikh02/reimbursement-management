import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, formatDate, humanize, money } from '../api.js';
import { useLoad } from '../useLoad.js';
import { validateClaimAction } from '../../../shared/validation.mjs';
import Icon from '../components/Icon.jsx';
import {
  Button,
  Card,
  ErrorBox,
  Field,
  Loading,
  Notice,
  PageHeader,
  StatGrid,
  StatusBadge,
  Table,
  Td,
  Textarea,
} from '../components/ui.jsx';

const DETAIL_LABELS = {
  travel_from: 'From',
  travel_to: 'To',
  distance_km: 'Distance (km)',
  hospital_name: 'Hospital',
  treatment_type: 'Treatment',
  purpose: 'Purpose',
  client_name: 'Client',
};

export default function ClaimDetail({ user }) {
  const { id } = useParams();
  const { data: claim, error: loadError, reload } = useLoad(`/claims/${id}`);
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const act = async (path, body) => {
    setError('');
    const validationError = validateClaimAction(
      claim,
      user,
      path === 'pay' ? 'PAID' : body.decision,
      body?.remarks,
    );
    if (validationError) return setError(validationError);
    setSaving(true);
    try {
      await api(`/claims/${id}/${path}`, { method: 'POST', body });
      reload();
    } catch (err) {
      setError(err.message);
      reload();
    } finally {
      setSaving(false);
    }
  };

  if (loadError) return <ErrorBox error={loadError} />;
  if (!claim) return <Loading label="Opening claim" />;

  const own = claim.applicant_id === user.id;
  const canDecide = user.is_manager && !own && claim.status === 'SUBMITTED';
  const canPay = user.is_manager && !own && claim.status === 'APPROVED';
  const approvalError = canDecide ? validateClaimAction(claim, user, 'APPROVED', remarks) : '';

  const reviewed = claim.status !== 'SUBMITTED';

  return (
    <>
      <PageHeader
        eyebrow="CLAIM DETAILS"
        title={`Claim CLM-${String(claim.reimbursement_id).padStart(3, '0')}`}
        description={`${humanize(claim.claim_type)} reimbursement / Submitted ${formatDate(claim.claim_date)}`}
        actions={<StatusBadge status={claim.status} />}
      />
      <ErrorBox error={error} />
      <StatGrid
        items={[
          {
            label: 'Claim amount',
            value: money(claim.total_amount),
            detail: humanize(claim.claim_type) + ' expense',
            icon: 'wallet',
          },
          {
            label: 'Expense items',
            value: claim.item_count,
            detail: 'Included in this claim',
            icon: 'receipt',
            tone: 'blue',
          },
          {
            label: 'Submitted on',
            value: formatDate(claim.claim_date),
            detail: 'Original claim date',
            icon: 'calendar',
            tone: 'amber',
          },
          {
            label: 'Reviewed by',
            value: claim.approver_name ?? 'Awaiting review',
            detail: claim.approval_date ? formatDate(claim.approval_date) : 'No decision yet',
            icon: 'shield',
            tone: 'purple',
          },
        ]}
      />
      <Card title="Claim overview" description="The people, details and progress behind this reimbursement">
        <dl className="info-grid">
          <Info label="Applicant">{claim.applicant_name}</Info>
          <Info label="Department">{claim.dept_name}</Info>
          <Info label="Claim type">{humanize(claim.claim_type)}</Info>
          {Object.entries(claim.details)
            .filter(([key]) => key !== 'reimbursement_id')
            .map(([key, value]) => (
              <Info key={key} label={DETAIL_LABELS[key] ?? humanize(key)}>
                {value || '-'}
              </Info>
            ))}
          {claim.remarks && <Info label="Manager remarks">{claim.remarks}</Info>}
        </dl>
        <div className="claim-progress" aria-label={`Claim status: ${claim.status}`}>
          <div className="progress-step done">
            <span>
              <Icon name="check" size={13} />
            </span>
            Submitted
          </div>
          <div className="progress-line" />
          <div className={`progress-step ${reviewed ? 'done' : ''}`}>
            <span>{reviewed ? <Icon name="check" size={13} /> : '2'}</span>
            {claim.status === 'REJECTED' ? 'Rejected' : 'Reviewed'}
          </div>
          {claim.status !== 'REJECTED' && (
            <>
              <div className="progress-line" />
              <div className={`progress-step ${claim.status === 'PAID' ? 'done' : ''}`}>
                <span>{claim.status === 'PAID' ? <Icon name="check" size={13} /> : '3'}</span>Paid
              </div>
            </>
          )}
        </div>
      </Card>
      <Card title="Expense breakdown" description="Individual expenses and their supporting documents">
        <Table headers={['Item', 'Expense date', 'Category', 'Description', 'Amount', 'Receipt']}>
          {claim.items.map((item) => (
            <tr key={item.item_no}>
              <Td>{String(item.item_no).padStart(2, '0')}</Td>
              <Td className="whitespace-nowrap">{formatDate(item.expense_date)}</Td>
              <Td>
                <span className="tag">{humanize(item.category)}</span>
              </Td>
              <Td>{item.description}</Td>
              <Td className="amount">{money(item.amount)}</Td>
              <Td>
                {item.receipt_path ? (
                  <a className="record-link" href={item.receipt_path} target="_blank" rel="noreferrer">
                    View receipt
                  </a>
                ) : (
                  <span className="table-meta">Not attached</span>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
      {(canDecide || canPay) && (
        <Card
          title={canDecide ? 'Review & decide' : 'Complete reimbursement'}
          description={
            canDecide
              ? 'Review the details above before recording your decision'
              : 'Mark this claim as paid after completing the reimbursement'
          }
        >
          {canDecide && (
            <div className="form-grid">
              <Field
                label="Manager remarks"
                hint="Required when rejecting a claim. Saved decisions cannot be edited."
              >
                <Textarea
                  maxLength={255}
                  placeholder="Add context for your decision..."
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                />
              </Field>
              <div>
                <Notice>Your approval limit is {money(user.approval_limit)} per claim.</Notice>
                {approvalError && <ErrorBox error={approvalError} />}
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="success"
                    disabled={saving || !!approvalError}
                    onClick={() => act('decision', { decision: 'APPROVED', remarks })}
                  >
                    <Icon name="check" size={16} />
                    Approve claim
                  </Button>
                  <Button
                    variant="danger"
                    disabled={saving || !remarks.trim()}
                    onClick={() => act('decision', { decision: 'REJECTED', remarks })}
                  >
                    <Icon name="close" size={16} />
                    Reject claim
                  </Button>
                </div>
              </div>
            </div>
          )}
          {canPay && (
            <Button disabled={saving} onClick={() => act('pay')}>
              <Icon name="wallet" size={16} />
              {saving ? 'Processing...' : 'Mark as paid'}
            </Button>
          )}
        </Card>
      )}
      <Button variant="secondary" onClick={() => navigate(-1)}>
        <Icon name="back" size={16} />
        Back to previous page
      </Button>
    </>
  );
}

function Info({ label, children }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
