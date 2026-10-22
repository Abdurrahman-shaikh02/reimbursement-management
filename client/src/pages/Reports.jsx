import { money } from '../api.js';
import { useLoad } from '../useLoad.js';
import { Card, ErrorBox, Table, Td } from '../components/ui.jsx';

// Plain tables of totals (FR9). Rejected claims are excluded except in "By status".
export default function Reports() {
  const { data, error } = useLoad('/manager/reports');
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;

  const section = (title, rows, countLabel = 'Claims', countKey = 'claims') => (
    <Card title={title}>
      <Table headers={['', countLabel, 'Total']}>
        {rows.map((r) => (
          <tr key={r.label}>
            <Td>{r.label}</Td>
            <Td>{r[countKey]}</Td>
            <Td>{money(r.total)}</Td>
          </tr>
        ))}
      </Table>
    </Card>
  );

  return (
    <div className="grid gap-x-6 md:grid-cols-2">
      {section('By department', data.byDepartment)}
      {section('By claim type', data.byType)}
      {section('By expense category', data.byCategory, 'Items', 'items')}
      {section('By month', data.byMonth)}
      {section('By status (all claims)', data.byStatus)}
    </div>
  );
}
