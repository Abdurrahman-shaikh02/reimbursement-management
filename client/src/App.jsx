import { Navigate, Route, Routes } from 'react-router';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import { Loading } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import MyClaims from './pages/MyClaims.jsx';
import NewClaim from './pages/NewClaim.jsx';
import ClaimDetail from './pages/ClaimDetail.jsx';
import Reviews from './pages/Reviews.jsx';
import Payments from './pages/Payments.jsx';
import Reports from './pages/Reports.jsx';
import Employees from './pages/Employees.jsx';
import EmployeeForm from './pages/EmployeeForm.jsx';
import Departments from './pages/Departments.jsx';

// Hides a route from users without the role. The API checks roles again,
// so this only keeps the menu and URLs tidy.
function RequireRole({ roles, children }) {
  const { user } = useAuth();
  return roles.some((r) => user.roles[r]) ? children : <Navigate to="/" replace />;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Login />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="claims" element={<RequireRole roles={['applicant']}><MyClaims /></RequireRole>} />
        <Route path="claims/new" element={<RequireRole roles={['applicant']}><NewClaim /></RequireRole>} />
        <Route path="claims/:id" element={<ClaimDetail />} />
        <Route path="reviews" element={<RequireRole roles={['manager']}><Reviews /></RequireRole>} />
        <Route path="payments" element={<RequireRole roles={['admin']}><Payments /></RequireRole>} />
        <Route path="reports" element={<RequireRole roles={['manager', 'admin']}><Reports /></RequireRole>} />
        <Route path="admin/employees" element={<RequireRole roles={['admin']}><Employees /></RequireRole>} />
        <Route path="admin/employees/new" element={<RequireRole roles={['admin']}><EmployeeForm /></RequireRole>} />
        <Route path="admin/employees/:id" element={<RequireRole roles={['admin']}><EmployeeForm /></RequireRole>} />
        <Route path="admin/departments" element={<RequireRole roles={['admin']}><Departments /></RequireRole>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
