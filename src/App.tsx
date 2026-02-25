import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import PasskeySetup from './pages/PasskeySetup';
import Settings from './pages/Settings';
import InvitePartner from './pages/InvitePartner';
import RegisterParentB from './pages/RegisterParentB';
import AdminPage from './pages/AdminPage';
import AdminRegistrationDetails from './pages/AdminRegistrationDetails';
import AdminRoute from './components/auth/AdminRoute';
import './i18n';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/setup-passkey" element={<PasskeySetup />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/invite-partner" element={<InvitePartner />} />
        <Route path="/register" element={<RegisterParentB />} />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/registrations/:id"
          element={
            <AdminRoute>
              <AdminRegistrationDetails />
            </AdminRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
