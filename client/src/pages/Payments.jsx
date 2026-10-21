import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, money } from '../api.js';
import { useLoad } from '../useLoad.js';
import { Button, Card, ErrorBox, Table, Td } from '../components/ui.jsx';

// Approved claims waiting to be paid
export default function Payments({ user }) {
  const { data: claims, error: loadError, reload } = useLoad('/manager/payments');
  const [error, setError] = useState('');

  const pay = async (id) => {
    setError('');
    try {
      await api(`/claims/${id}/pay`, { method: 'POST' });
      reload();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Card title="Approved claims waiting for payment">
      <ErrorBox error={loadError || error} />
      <Table headers={['#', 'Approved on', 'Applicant', 'Bank account', 'Approved by', 'Total', '']} empty="Nothing to pay.">
        {claims?.map((c) => (
          <tr key={c.reimbursement_id}>
            <Td><Link className="text-blue-700 underline" to={`/claims/${c.reimbursement_id}`}>{c.reimbursement_id}</Link></Td>
            <Td>{c.approval_date}</Td>
            <Td>{c.applicant_name}</Td>
            <Td className="font-mono">{c.bank_account_no}</Td>
            <Td>{c.approver_name}</Td>
            <Td>{money(c.total_amount)}</Td>
            <Td>
              {c.applicant_id === user.id
                ? <span className="text-xs text-gray-500">your own claim</span>
                : <Button onClick={() => pay(c.reimbursement_id)}>Mark paid</Button>}
            </Td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}
