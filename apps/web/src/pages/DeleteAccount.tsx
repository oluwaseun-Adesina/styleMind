import { useState, type FormEvent } from 'react';
import { API_BASE } from '../services/apiClient';

// Public account-deletion page, served at /delete-account. Google Play
// requires a web resource where users can request account deletion without
// reinstalling the app. Email+password accounts can delete directly here;
// Google-sign-in accounts are directed to the in-app flow or email.

// Public-facing support contact. Override at deploy with VITE_CONTACT_EMAIL to
// avoid exposing a personal address on the Play Store listing.
const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL || 'oluwaseunadesina8@gmail.com';

export default function DeleteAccount() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'working' | 'done'>('idle');
  const [error, setError] = useState('');

  const handleDelete = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (!window.confirm('Permanently delete this account and all its data? This cannot be undone.')) return;
    setStatus('working');
    setError('');
    try {
      // Authenticate, then delete with the same credentials.
      const loginRes = await fetch(`${API_BASE()}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const loginJson = await loginRes.json().catch(() => ({}));
      if (!loginRes.ok) {
        throw new Error(loginJson?.error || 'Email or password is incorrect.');
      }
      const token: string = loginJson?.data?.token;

      const delRes = await fetch(`${API_BASE()}/api/auth/me`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ confirm: 'DELETE', password }),
      });
      const delJson = await delRes.json().catch(() => ({}));
      if (!delRes.ok) {
        throw new Error(delJson?.error || 'Could not delete the account.');
      }
      setStatus('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setStatus('idle');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F7F4] dark:bg-[#121212]">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <a href="/" className="text-xs uppercase font-bold text-[#8E8E8A] hover:underline">
          ← FitPick
        </a>
        <h1 className="text-3xl font-serif italic mt-4 mb-2 text-[#1A1A1A] dark:text-white">Delete Your Account</h1>
        <p className="text-sm leading-relaxed text-[#4A4A46] dark:text-[#B5B5B1] mb-8">
          Deleting your FitPick account permanently removes your profile, wardrobe items, saved outfits, and
          calendar events. This cannot be undone.
        </p>

        {status === 'done' ? (
          <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl p-6 text-sm text-[#4A4A46] dark:text-[#B5B5B1]">
            ✅ Your account and all associated data have been permanently deleted.
          </div>
        ) : (
          <>
            <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl p-6 mb-6">
              <h2 className="text-lg font-serif italic mb-3 text-[#1A1A1A] dark:text-white">
                Email &amp; password accounts
              </h2>
              <form onSubmit={handleDelete} className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  required
                  className="w-full bg-[#F8F7F4] dark:bg-[#2A2A2A] p-3 rounded-xl text-sm dark:text-white outline-none"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                  className="w-full bg-[#F8F7F4] dark:bg-[#2A2A2A] p-3 rounded-xl text-sm dark:text-white outline-none"
                />
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                  type="submit"
                  disabled={status === 'working' || !email || !password}
                  className="w-full py-3 rounded-xl bg-red-600 text-white text-sm font-medium disabled:opacity-50"
                >
                  {status === 'working' ? 'Deleting…' : 'Permanently Delete My Account'}
                </button>
              </form>
            </div>

            <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl p-6 text-sm text-[#4A4A46] dark:text-[#B5B5B1] space-y-2">
              <h2 className="text-lg font-serif italic text-[#1A1A1A] dark:text-white">Google sign-in accounts</h2>
              <p>
                If you signed in with Google, open the FitPick app, go to <strong>Settings → Delete
                Account</strong>, or email{' '}
                <a className="underline" href={`mailto:${CONTACT_EMAIL}?subject=FitPick%20account%20deletion%20request`}>
                  {CONTACT_EMAIL}
                </a>{' '}
                from your account's email address and we will delete it for you.
              </p>
            </div>
          </>
        )}

        <p className="text-xs text-[#8E8E8A] mt-6">
          See our <a className="underline" href="/privacy">privacy policy</a> for details on what data FitPick stores.
        </p>
      </div>
    </div>
  );
}
