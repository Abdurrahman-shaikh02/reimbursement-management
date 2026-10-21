import { Link } from 'react-router-dom';
import { money } from '../api.js';
import { useLoad } from '../useLoad.js';
import { Card, ErrorBox, Table, Td } from '../components/ui.jsx';

// Claims waiting for a decision that this manager is allowed to make
export default function Approvals({ user }) {
  const { data: claims, error } = useLoad('/manager/approvals');
  return (
    <Card title="Claims waiting for your decision">
      <p className="mb-3 text-sm text-gray-600">
        Submitted claims within your approval limit of {money(user.approval_limit)}, excluding your own.
      </p>
      <ErrorBox error={error} />
      <Table headers={['#', 'Date', 'Applicant', 'Department', 'Type', 'Items', 'Total']} empty="No claims are waiting for you.">
        {claims?.map((c) => (
          <tr key={c.reimbursement_id}>
            <Td><Link className="text-blue-700 underline" to={`/claims/${c.reimbursement_id}`}>{c.reimbursement_id}</Link></Td>
            <Td>{c.claim_date}</Td>
            <Td>{c.applicant_name}</Td>
            <Td>{c.dept_name}</Td>
            <Td>{c.claim_type}</Td>
            <Td>{c.item_count}</Td>
            <Td>{money(c.total_amount)}</Td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}
