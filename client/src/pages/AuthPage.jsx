import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function AuthPage() {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login, register } = useAuth();

  const handleSwitchMode = (targetMode) => {
    setMode(targetMode);
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (mode === 'register') {
        await register(name, email, password);
        navigate('/');
      } else {
        await login(email, password);
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to complete that request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.25),_transparent_45%),linear-gradient(135deg,_#020617,_#111827)] px-4 py-12 text-slate-100">
      <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 shadow-2xl shadow-cyan-950/40 backdrop-blur-xl">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
          <div className="bg-slate-950/70 p-8 sm:p-10">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-400">Chat-Verse</p>
            <h1 className="mt-4 text-4xl font-semibold sm:text-5xl">A modern place for real conversations.</h1>
            <p className="mt-4 max-w-lg text-lg text-slate-300">
              Join a polished workspace for private chats, instant replies, and effortless collaboration.
            </p>
          </div>

          <div className="p-8 sm:p-10">
            <div className="flex rounded-full border border-white/10 bg-slate-800/80 p-1">
              <button
                type="button"
                className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${mode === 'login' ? 'bg-cyan-500 text-white' : 'text-slate-300 hover:text-white'}`}
                onClick={() => handleSwitchMode('login')}
              >
                Login
              </button>
              <button
                type="button"
                className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${mode === 'register' ? 'bg-cyan-500 text-white' : 'text-slate-300 hover:text-white'}`}
                onClick={() => handleSwitchMode('register')}
              >
                Register
              </button>
            </div>

            <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
              {mode === 'register' && (
                <label className="block">
                  <span className="mb-2 block text-sm text-slate-300">Display name</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-800/70 px-4 py-3 text-sm outline-none ring-0 transition focus:border-cyan-500"
                    placeholder="Ava"
                    required
                  />
                </label>
              )}

              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-800/70 px-4 py-3 text-sm outline-none ring-0 transition focus:border-cyan-500"
                  placeholder="you@example.com"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">Password</span>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-800/70 pl-4 pr-11 py-3 text-sm outline-none ring-0 transition focus:border-cyan-500"
                    placeholder="At least 6 characters"
                    minLength="6"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-cyan-400 focus:outline-none transition"
                    title={showPassword ? 'Hide password' : 'Show password'}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </label>

              {error && <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>}
              {success && <p className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{success}</p>}

              <button
                type="submit"
                className="w-full rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={loading}
              >
                {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
