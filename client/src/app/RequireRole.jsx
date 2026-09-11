import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function RequireRole({ role, children }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/" replace />;
  if (user.tipo !== role) return <Navigate to={`/${user.tipo}`} replace />;

  return children;
}
