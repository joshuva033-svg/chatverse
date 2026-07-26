import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../services/api.js';

export default function AuthPage() {
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot'
  const [resetStep, setResetStep] = useState('email'); // 'email' | 'code'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [simulatedCode, setSimulatedCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login, register } = useAuth();

  const handleSwitchMode = (targetMode) => {
    setMode(targetMode);
    setResetStep('email');
    setResetCode('');
    setNewPassword('');
    setSimulatedCode('');
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
        setSuccess('Registration successful! Please sign in with your credentials.');
        setPassword('');
        setMode('login');
      } else if (mode === 'login') {
        await login(email, password);
        navigate('/');
      } else if (mode === 'forgot') {
        if (resetStep === 'email') {
          const { data } = await api.post('/api/forgot-password', { email }).catch(() => {
            // Fallback if not using prefixed routes
            return api.post('/api/auth/forgot-password', { email });
          });
          setSimulatedCode(data.code);
          setResetStep('code');
          setSuccess('Simulated recovery code sent to your email.');
        } else {
          const { data } = await api.post('/api/reset-password', {
            email,
            code: resetCode,
            newPassword,
          }).catch(() => {
            return api.post('/api/auth/reset-password', {
              email,
              code: resetCode,
              newPassword,
            });
          });
          setSuccess(data.message);
          handleSwitchMode('login');
        }
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

            <form className="mt-8 space-y-4" onSubmit={handleSubmit} autoComplete="off">
              {mode === 'forgot' && (
                <div className="mb-2">
                  <h3 className="text-lg font-bold text-white">Reset Password</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {resetStep === 'email'
                      ? 'Enter your registered email address to verify your account.'
                      : 'Enter the recovery code sent and your new password.'}
                  </p>
                </div>
              )}

              {/* Step 1: Email Input */}
              {(mode !== 'forgot' || resetStep === 'email') && (
                <>
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
                        autoComplete="off"
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
                      autoComplete="off"
                    />
                  </label>

                  {(mode === 'login' || mode === 'register') && (
                    <label className="block">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-slate-300">Password</span>
                        {mode === 'login' && (
                          <button
                            type="button"
                            onClick={() => handleSwitchMode('forgot')}
                            className="text-xs text-cyan-400 hover:text-cyan-300 hover:underline transition"
                          >
                            Forgot Password?
                          </button>
                        )}
                      </div>
                      <input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-slate-800/70 px-4 py-3 text-sm outline-none ring-0 transition focus:border-cyan-500"
                        placeholder="At least 6 characters"
                        minLength="6"
                        required
                        autoComplete="new-password"
                      />
                    </label>
                  )}
                </>
              )}

              {/* Step 2: Code and New Password Inputs (Forgot Mode only) */}
              {mode === 'forgot' && resetStep === 'code' && (
                <>
                  {simulatedCode && (
                    <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-xs leading-relaxed text-cyan-200">
                      ℹ️ <strong>Simulated Email Sent!</strong> Because the app is running locally, your verification code is: <code className="bg-slate-950 px-2 py-0.5 rounded font-mono font-bold text-sm text-cyan-300 select-all">{simulatedCode}</code>
                    </div>
                  )}

                  <label className="block">
                    <span className="mb-2 block text-sm text-slate-300">Recovery Code</span>
                    <input
                      type="text"
                      value={resetCode}
                      onChange={(event) => setResetCode(event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-slate-800/70 px-4 py-3 text-sm outline-none ring-0 transition focus:border-cyan-500"
                      placeholder="123456"
                      required
                      autoComplete="off"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm text-slate-300">New Password</span>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-slate-800/70 px-4 py-3 text-sm outline-none ring-0 transition focus:border-cyan-500"
                      placeholder="Enter new password (min 6 characters)"
                      minLength="6"
                      required
                      autoComplete="new-password"
                    />
                  </label>
                </>
              )}

              {error && <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>}
              {success && <p className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{success}</p>}

              <button
                type="submit"
                className="w-full rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={loading}
              >
                {loading
                  ? 'Please wait…'
                  : mode === 'login'
                  ? 'Sign in'
                  : mode === 'register'
                  ? 'Create account'
                  : resetStep === 'email'
                  ? 'Send recovery code'
                  : 'Reset password'}
              </button>

              {mode === 'forgot' && (
                <div className="text-center mt-2">
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('login')}
                    className="text-xs text-slate-400 hover:text-slate-200 hover:underline transition"
                  >
                    ← Back to Login
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
