import { Link } from 'react-router-dom';
import { useAuth } from '../lib/state.jsx';
import { Header } from '../components/Layout.jsx';

export default function NotFound() {
  const { user } = useAuth();
  return (
    <div className="page"><Header showCategory={false} />
      <div className="col ac jc g12" style={{ minHeight: '60vh', textAlign: 'center', padding: 24 }}>
        <span className="h1 acc2">404</span><b className="s18">This page doesn’t exist</b><span className="s13 muted">The link may be old, or the location belonged to a scoring run that was replaced.</span>
        <Link to={user ? '/app' : '/'} className="btn ink">{user ? 'Back to dashboard' : 'Go home'}</Link>
      </div>
    </div>
  );
}
