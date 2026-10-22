import { Link } from 'react-router-dom';
import { money } from '../api.js';
import { useLoad } from '../useLoad.js';
import { Card, ErrorBox, StatusBadge, Table, Td } from '../components/ui.jsx';

export default function MyClaims() {
  const { data: claims, error } = useLoad('/claims');
  return (
    <Card title="My claims" actions={<Link to="/claims/new" className="text-sm text-blue-700 underline">New claim</Link>}>
      <ErrorBox error={error} />
      <Table headers={['#', 'Date', 'Type', 'Items', 'Total', 'Status', 'Decided by', 'Remarks']}>
        {claims?.map((c) => (
          <tr key={c.reimbursement_id}>
            <Td><Link className="text-blue-700 underline" to={`/claims/${c.reimbursement_id}`}>{c.reimbursement_id}</Link></Td>
            <Td>{c.claim_date}</Td>
            <Td>{c.claim_type}</Td>
            <Td>{c.item_count}</Td>
            <Td>{money(c.total_amount)}</Td>
            <Td><StatusBadge status={c.status} /></Td>
            <Td>{c.approver_name ?? '—'}</Td>
            <Td className="text-gray-600">{c.remarks ?? ''}</Td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}
