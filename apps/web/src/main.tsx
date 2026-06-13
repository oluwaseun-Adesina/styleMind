import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App.tsx';
import PrivacyPolicy from './pages/PrivacyPolicy.tsx';
import DeleteAccount from './pages/DeleteAccount.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'dummy-client-id';

// Minimal path routing for the public policy pages required by the Play
// Store listing. Everything else renders the main app.
const page = () => {
  const path = window.location.pathname.replace(/\/+$/, '');
  if (path === '/privacy') return <PrivacyPolicy />;
  if (path === '/delete-account') return <DeleteAccount />;
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>{page()}</ErrorBoundary>
  </StrictMode>,
);
