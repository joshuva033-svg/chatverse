import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProfilePage() {
  const { user, setUser, logout } = useAuth();
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [status, setStatus] = useState('');
  const [readReceipts, setReadReceipts] = useState(true);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const darkTheme = localStorage.getItem('theme') !== 'light';

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setAvatar(user.avatar || '');
      setAvatarUrl(user.avatarUrl || '');
      setStatus(user.status || '');
      setReadReceipts(user.readReceipts !== false);
    }
  }, [user]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setMessage('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const { data } = await api.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setAvatarUrl(data.url);
      setMessage('Avatar photo uploaded! Click "Save Profile" below to persist changes.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to upload photo.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const { data } = await api.put('/api/users/me/profile', {
        name,
        avatar,
        avatarUrl,
        status,
        readReceipts,
      });
      setUser(data.user);
      setMessage(`Profile updated successfully.`);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to update profile right now.');
    } finally {
      setLoading(false);
    }
  };

  // theme classes mapping
  const bgClass = darkTheme
    ? 'bg-slate-950 text-slate-100'
    : 'bg-slate-50 text-slate-900';
    
  const cardClass = darkTheme
    ? 'border-white/10 bg-slate-900/80 shadow-cyan-950/20'
    : 'border-slate-200/80 bg-white shadow-slate-200/80';
    
  const sectionClass = darkTheme
    ? 'border-white/10 bg-slate-800/70'
    : 'border-slate-100 bg-slate-50/70';
    
  const inputClass = darkTheme
    ? 'border-white/10 bg-slate-900/80 text-white focus:border-cyan-500'
    : 'border-slate-200 bg-white text-slate-900 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500';

  const labelSpanClass = darkTheme ? 'text-slate-300' : 'text-slate-700';
  
  return (
    <div className={`min-h-screen px-4 py-10 transition-colors duration-300 ${bgClass} sm:px-6 lg:px-8`}>
      <div className={`mx-auto max-w-4xl rounded-3xl border p-6 shadow-2xl ${cardClass} sm:p-8`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-400">Settings</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Manage identity</h1>
            <p className={`mt-2 max-w-2xl text-sm leading-relaxed ${darkTheme ? 'text-slate-400' : 'text-slate-500'}`}>
              Customize your profile photo, status message, display name, and double check preferences.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              to="/"
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition duration-300 ${
                darkTheme
                  ? 'border-white/10 text-slate-300 hover:border-cyan-500 hover:text-white hover:bg-cyan-500/10'
                  : 'border-slate-200 text-slate-600 hover:border-cyan-500 hover:text-cyan-600 hover:bg-cyan-50/50'
              }`}
            >
              Back to chat
            </Link>
            <button
              type="button"
              onClick={logout}
              className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-cyan-400"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          {/* Profile Card Preview */}
          <div className={`rounded-3xl border p-6 flex flex-col justify-between ${sectionClass}`}>
            <div>
              <div className="flex items-center gap-4">
                <div
                  onClick={handleAvatarClick}
                  className="relative group h-20 w-20 shrink-0 cursor-pointer rounded-full overflow-hidden border-2 border-cyan-500 shadow-lg hover:border-cyan-400 transition"
                  title="Click to change photo"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-cyan-500/20 text-2xl font-bold text-cyan-300">
                      {(avatar || user?.avatar || user?.name?.slice(0, 1) || 'U').toUpperCase()}
                    </div>
                  )}
                  {/* Photo Overlay hover trigger */}
                  <div className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition duration-200 text-[10px] text-white font-bold text-center p-1">
                    {isUploading ? 'Uploading...' : 'Change Photo'}
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xl font-bold truncate">{user?.name}</p>
                  <p className={`text-xs truncate ${darkTheme ? 'text-slate-400' : 'text-slate-500'}`}>{user?.email}</p>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setAvatarUrl('');
                        setMessage('Avatar photo removed! Click "Save Profile" below to persist changes.');
                      }}
                      className="mt-2 text-xs font-semibold text-rose-400 hover:text-rose-300 transition duration-300 flex items-center gap-1.5 hover:underline"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Remove photo
                    </button>
                  )}
                </div>
              </div>

              {/* Status Display preview */}
              <div className="mt-6 rounded-2xl border border-cyan-500/10 bg-cyan-500/5 p-4.5 text-sm">
                <p className="font-semibold text-cyan-400 tracking-wider text-xs uppercase">Custom Status</p>
                <p className={`mt-2 italic leading-relaxed ${darkTheme ? 'text-slate-300' : 'text-slate-700'}`}>
                  "{status || 'No status set.'}"
                </p>
              </div>
            </div>

            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handlePhotoUpload}
              accept="image/*"
              className="hidden"
            />

            <div className={`mt-6 text-xs leading-relaxed ${darkTheme ? 'text-slate-400' : 'text-slate-500'}`}>
              💡 Tip: Click on your avatar circle directly to upload and set a premium photo!
            </div>
          </div>

          {/* Form */}
          <form className={`rounded-3xl border p-6 space-y-4 ${sectionClass}`} onSubmit={handleSubmit}>
            <label className="block">
              <span className={`mb-1.5 block text-xs font-bold uppercase tracking-widest ${labelSpanClass}`}>Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition ${inputClass}`}
                placeholder="Your name"
                required
              />
            </label>

            <label className="block">
              <span className={`mb-1.5 block text-xs font-bold uppercase tracking-widest ${labelSpanClass}`}>Avatar Initial</span>
              <input
                value={avatar}
                onChange={(event) => setAvatar(event.target.value)}
                className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition ${inputClass}`}
                placeholder="One letter or emoji"
                maxLength="4"
              />
            </label>

            <label className="block">
              <span className={`mb-1.5 block text-xs font-bold uppercase tracking-widest ${labelSpanClass}`}>Status Message</span>
              <input
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition ${inputClass}`}
                placeholder="Hey there! I am using Chat-Verse."
              />
            </label>

            {/* Double Check Toggles */}
            <div className={`flex items-center justify-between rounded-2xl border p-4 ${darkTheme ? 'border-white/5 bg-slate-900/40' : 'border-slate-200/60 bg-white shadow-sm'}`}>
              <div>
                <p className="text-sm font-semibold">Read Receipts (Blue Ticks)</p>
                <p className={`text-xs mt-1 ${darkTheme ? 'text-slate-400' : 'text-slate-500'}`}>
                  If disabled, others won't see blue ticks when you read their messages.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReadReceipts(!readReceipts)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${readReceipts ? 'bg-cyan-500' : 'bg-slate-600'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${readReceipts ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {message && (
              <p className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-xs font-semibold text-cyan-300">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || isUploading}
              className="w-full rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-bold text-white uppercase tracking-wider transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70 shadow-lg shadow-cyan-500/25"
            >
              {loading ? 'Saving…' : 'Save profile'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
