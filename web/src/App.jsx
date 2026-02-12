
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Upgrade from './pages/Upgrade';
import DeployAgent from './pages/DeployAgent';
import './App.css';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute requirePayment={true}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/upgrade"
            element={
              <ProtectedRoute requirePayment={false}>
                <Upgrade />
              </ProtectedRoute>
            }
          />
          <Route
            path="/deploy"
            element={
              <ProtectedRoute requirePayment={true}>
                <DeployAgent />
              </ProtectedRoute>
            }
          />
          {/* Catch all redirect to root */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
