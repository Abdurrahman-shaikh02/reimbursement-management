import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { api, getToken, setToken } from './api.js';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import MyClaims from './pages/MyClaims.jsx';
import NewClaim from './pages/NewClaim.jsx';
import ClaimDetail from './pages/ClaimDetail.jsx';
import Approvals from './pages/Approvals.jsx';
import Payments from './pages/Payments.jsx';
import Departments from './pages/Departments.jsx';
import Employees from './pages/Employees.jsx';
import EmployeeForm from './pages/EmployeeForm.jsx';
import Reports from './pages/Reports.jsx';
import { Card, Loading, Notice, PageHeader } from './components/ui.jsx';

// Where each user lands after logging in
const home = (user) => (user.is_applicant ? '/claims' : user.is_manager ? '/approvals' : '/no-role');

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());
  const navigate = useNavigate();

  // Restore the session from the stored token
  useEffect(() => {
    if (!getToken()) return;
    api('/auth/me')
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const onLogin = ({ token, user: u }) => {
    setToken(token);
    setUser(u);
    navigate(home(u));
  };

  const onLogout = () => {
    setToken(null);
    setUser(null);
    navigate('/login');
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading label="Restoring your session" />
      </div>
    );
  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login onLogin={onLogin} />} />
      </Routes>
    );
  }

  const applicantOnly = (el) => (user.is_applicant ? el : <Navigate to={home(user)} />);

  const managerOnly = (el) => (user.is_manager ? el : <Navigate to={home(user)} />);

  return (
    <Layout user={user} onLogout={onLogout}>
      <Routes>
        <Route path="/claims" element={applicantOnly(<MyClaims />)} />
        <Route path="/claims/new" element={applicantOnly(<NewClaim />)} />
        <Route path="/claims/:id" element={<ClaimDetail user={user} />} />
        <Route path="/approvals" element={managerOnly(<Approvals user={user} />)} />
        <Route path="/payments" element={managerOnly(<Payments user={user} />)} />
        <Route path="/departments" element={managerOnly(<Departments />)} />
        <Route path="/employees" element={managerOnly(<Employees />)} />
        <Route path="/employees/new" element={managerOnly(<EmployeeForm />)} />
        <Route path="/employees/:id" element={managerOnly(<EmployeeForm />)} />
        <Route path="/reports" element={managerOnly(<Reports />)} />
        <Route
          path="/no-role"
          element={
            <>
              <PageHeader
                title="Welcome to your workspace"
                description="Your profile is ready. Your next step is getting the right access."
              />
              <Card title="A role is needed to get started">
                <Notice>
                  Ask a manager to register you as an applicant or manager so you can start using the
                  workspace.
                </Notice>
              </Card>
            </>
          }
        />
        <Route path="*" element={<Navigate to={home(user)} />} />
      </Routes>
    </Layout>
  );
}
