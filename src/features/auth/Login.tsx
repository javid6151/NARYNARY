import { Navigate } from 'react-router-dom';

/**
 * The standalone /login page has been removed in favor of the direct home page (/) login system.
 * Any direct navigation to Login redirects to /
 */
export default function Login() {
  return <Navigate to="/" replace />;
}
