import { humanize, money } from '../api.js';
import { useLoad } from '../useLoad.js';
import { Card, ErrorBox, Loading, PageHeader, StatGrid, StatusBadge, Table, Td } from '../components/ui.jsx';

function ReportSection({
  title,
  description,
  rows,
  countLabel = 'Claims',
  countKey = 'claims',
  status = false,
}) {
  const maximum = Math.max(...rows.map((row) => Number(row.total)), 1);
  return (
    <Card title={title} description={description}>
      <div className="report-chart" aria-label={title + ' amounts'}>
        {rows.slice(0, 6).map((row) => (
          <div className="bar-row" key={row.label}>
            <div className="bar-label">
              <span>{humanize(row.label)}</span>
              <strong>{money(row.total)}</strong>
            </div>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ width: Math.max(0, (Number(row.total) / maximum) * 100) + '%' }}
              />
            </div>
          </div>
        ))}
      </div>
      <Table headers={['Breakdown', countLabel, 'Amount']}>
        {rows.map((row) => (
          <tr key={row.label}>
            <Td>{status ? <StatusBadge status={row.label} /> : humanize(row.label)}</Td>
            <Td>{row[countKey]}</Td>
            <Td className="amount">{money(row.total)}</Td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}

export default function Reports() {
  const { data, error, loading } = useLoad('/manager/reports');
  const statuses = data?.byStatus ?? [];
  const paid = statuses.find((row) => row.label === 'PAID');
  const pending = statuses.find((row) => row.label === 'SUBMITTED');
  const active = statuses.filter((row) => row.label !== 'REJECTED');

  return (
    <>
      <PageHeader
        eyebrow="FINANCIAL INSIGHTS"
        title="Reports & analytics"
        description="A clearer picture of where your team's expenses go."
      />
      <ErrorBox error={error} />
      <StatGrid
        items={[
          {
            label: 'Total expense value',
            value: data && money(active.reduce((sum, row) => sum + Number(row.total), 0)),
            detail: 'Excluding rejected claims',
            icon: 'chart',
          },
          {
            label: 'Reimbursed',
            value: data && money(paid?.total ?? 0),
            detail: (paid?.claims ?? 0) + ' paid claims',
            icon: 'wallet',
            tone: 'blue',
          },
          {
            label: 'Pending review',
            value: data && money(pending?.total ?? 0),
            detail: (pending?.claims ?? 0) + ' submitted claims',
            icon: 'clock',
            tone: 'amber',
          },
          {
            label: 'Total claims',
            value: data && statuses.reduce((sum, row) => sum + Number(row.claims), 0),
            detail: 'Across every claim status',
            icon: 'receipt',
            tone: 'purple',
          },
        ]}
      />
      {loading && !data ? (
        <Card>
          <Loading label="Preparing your reports" />
        </Card>
      ) : (
        data && (
          <div className="report-grid">
            <ReportSection
              title="Spending by department"
              description="Expense distribution across teams"
              rows={data.byDepartment}
            />
            <ReportSection
              title="Spending by claim type"
              description="Travel, medical and business expenses"
              rows={data.byType}
            />
            <ReportSection
              title="Expense categories"
              description="The details behind your spending"
              rows={data.byCategory}
              countLabel="Items"
              countKey="items"
            />
            <ReportSection
              title="Monthly overview"
              description="Expense totals grouped by claim month"
              rows={data.byMonth}
            />
            <ReportSection
              title="Claim status overview"
              description="All claims, including rejected submissions"
              rows={data.byStatus}
              status
            />
          </div>
        )
      )}
    </>
  );
}
