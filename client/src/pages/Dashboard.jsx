import { useAuth } from '../auth.jsx';
import { useApi } from '../useApi.js';
import { money } from '../format.js';
import { Card, ClaimsTable, ErrorBanner, LinkButton, Loading, PageHeader, StatCard } from '../components/ui.jsx';

function byStatus(rows, status) {
  return rows?.find((r) => r.status === status) ?? { claims: 0, amount: 0 };
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data, error, loading } = useApi('/meta/dashboard');
  const { roles } = user;

  return (
    <>
      <PageHeader
        title={`Hello, ${user.name.split(' ')[0]}`}
        subtitle="Your claims and the work waiting for you"
        actions={roles.applicant && <LinkButton to="/claims/new">New claim</LinkButton>}
      />
      <ErrorBanner error={error} />
      {loading && <Loading />}

      {data && (
        <div className="space-y-6">
          {(roles.manager || roles.admin) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {roles.manager && (
                <StatCard
                  label="Claims waiting for your review"
                  value={data.pendingReviews.claims}
                  sub={`${money(data.pendingReviews.amount)} in total · your limit ${money(user.approval_limit)}`}
                  to="/reviews"
                />
              )}
              {roles.admin && (
                <StatCard
                  label="Approved claims waiting for payment"
                  value={data.pendingPayments.claims}
                  sub={`${money(data.pendingPayments.amount)} to disburse`}
                  to="/payments"
                />
              )}
            </div>
          )}

          {roles.applicant && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ['SUBMITTED', 'Waiting for review'],
                  ['APPROVED', 'Approved, not yet paid'],
                  ['PAID', 'Paid to your account'],
                  ['REJECTED', 'Rejected'],
                ].map(([status, text]) => {
                  const s = byStatus(data.myClaims, status);
                  return <StatCard key={status} label={text} value={money(s.amount)} sub={`${s.claims} claim${s.claims === 1 ? '' : 's'}`} />;
                })}
              </div>
              <Card title="Your recent claims" actions={<LinkButton variant="ghost" to="/claims">View all</LinkButton>}>
                <ClaimsTable claims={data.recent} />
              </Card>
            </>
          )}
        </div>
      )}
    </>
  );
}
