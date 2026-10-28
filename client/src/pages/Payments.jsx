import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatDate, money } from '../api.js';
import { useLoad } from '../useLoad.js';
import { validateClaimAction } from '../../../shared/validation.mjs';
import Icon from '../components/Icon.jsx';
import { Avatar, Button, Card, ErrorBox, PageHeader, StatGrid, Table, Td } from '../components/ui.jsx';

// Approved claims waiting to be paid
export default function Payments({ user }) {
  const { data: claims, error: loadError, loading, reload } = useLoad('/manager/payments');
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(null);

  const pay = async (claim) => {
    setError('');
    const validationError = validateClaimAction(claim, user, 'PAID');
    if (validationError) return setError(validationError);
    setPaying(claim.reimbursement_id);
    try {
      await api(`/claims/${claim.reimbursement_id}/pay`, { method: 'POST' });
      reload();
    } catch (err) {
      setError(err.message);
      reload();
    } finally {
      setPaying(null);
    }
  };

  const rows = claims ?? [];

  return (
    <>
      <PageHeader
        eyebrow="PAYMENT OPERATIONS"
        title="Payments"
        description="Turn approved expenses into completed reimbursements."
      />
      <StatGrid
        items={[
          {
            label: 'Ready for payment',
            value: claims && rows.length,
            detail: 'Approved claims',
            icon: 'wallet',
          },
          {
            label: 'Amount outstanding',
            value: claims && money(rows.reduce((sum, claim) => sum + Number(claim.total_amount), 0)),
            detail: 'Across the payment queue',
            icon: 'chart',
            tone: 'amber',
          },
          {
            label: 'Employees to reimburse',
            value: claims && new Set(rows.map((claim) => claim.applicant_id)).size,
            detail: 'Unique claim applicants',
            icon: 'users',
            tone: 'blue',
          },
          {
            label: 'You can process',
            value: claims && rows.filter((claim) => claim.applicant_id !== user.id).length,
            detail: 'Excluding your own claims',
            icon: 'check',
            tone: 'purple',
          },
        ]}
      />
      <Card
        title="Ready to reimburse"
        description="Verify the claim and bank details before marking a payment complete"
        actions={<span className="tag">{rows.length} approved</span>}
      >
        <ErrorBox error={loadError || error} />
        <Table
          loading={loading && !claims}
          headers={['Claim', 'Approved', 'Applicant', 'Bank account', 'Reviewed by', 'Amount', '']}
          empty="All payments are up to date."
        >
          {rows.map((claim) => (
            <tr key={claim.reimbursement_id}>
              <Td>
                <Link className="record-link" to={`/claims/${claim.reimbursement_id}`}>
                  CLM-{String(claim.reimbursement_id).padStart(3, '0')}
                </Link>
              </Td>
              <Td className="whitespace-nowrap">{formatDate(claim.approval_date)}</Td>
              <Td>
                <span className="person-cell">
                  <Avatar name={claim.applicant_name} small />
                  <strong>{claim.applicant_name}</strong>
                </span>
              </Td>
              <Td className="font-mono">{claim.bank_account_no}</Td>
              <Td>{claim.approver_name}</Td>
              <Td className="amount">{money(claim.total_amount)}</Td>
              <Td>
                {claim.applicant_id === user.id ? (
                  <span className="tag">Your own claim</span>
                ) : (
                  <Button disabled={paying !== null} onClick={() => pay(claim)}>
                    <Icon name="check" size={14} />
                    {paying === claim.reimbursement_id ? 'Processing...' : 'Mark paid'}
                  </Button>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
