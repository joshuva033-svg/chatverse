import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';

export default function StatusViewerModal({
  isOpen,
  statusGroups,
  initialUserIndex = 0,
  currentUser,
  onClose,
  onReplyToStatus,
  onStatusDeleted,
}) {
  const [currentUserIdx, setCurrentUserIdx] = useState(initialUserIndex);
  const [currentStatusIdx, setCurrentStatusIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showViewsDrawer, setShowViewsDrawer] = useState(false);

  const videoRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    setCurrentUserIdx(initialUserIndex);
    setCurrentStatusIdx(0);
    setProgress(0);
  }, [initialUserIndex, isOpen]);

  const activeGroup = statusGroups[currentUserIdx];
  const activeStatus = activeGroup?.statuses[currentStatusIdx];

  // Mark status as viewed when displayed
  useEffect(() => {
    if (activeStatus && currentUser && activeStatus.userId !== currentUser.id && !activeStatus.isViewed) {
      api.post(`/api/status/${activeStatus.id}/view`).catch((err) => console.error('Failed to mark status viewed:', err));
    }
  }, [activeStatus, currentUser]);

  const handleNext = React.useCallback(() => {
    const group = statusGroups[currentUserIdx];
    if (!group) {
      onClose();
      return;
    }
    if (currentStatusIdx < group.statuses.length - 1) {
      setCurrentStatusIdx((prev) => prev + 1);
      setProgress(0);
    } else if (currentUserIdx < statusGroups.length - 1) {
      setCurrentUserIdx((prev) => prev + 1);
      setCurrentStatusIdx(0);
      setProgress(0);
    } else {
      onClose();
    }
  }, [currentStatusIdx, currentUserIdx, statusGroups, onClose]);

  // Progress Bar & Auto-Advance Logic
  useEffect(() => {
    if (!isOpen || !activeStatus || isPaused || showViewsDrawer) return;

    setProgress(0);
    const isVideo = activeStatus.mediaType === 'video';
    const durationMs = isVideo ? 15000 : 5000;
    const intervalTime = 50;
    const step = (intervalTime / durationMs) * 100;

    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timerRef.current);
          handleNext();
          return 100;
        }
        return prev + step;
      });
    }, intervalTime);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, currentUserIdx, currentStatusIdx, isPaused, showViewsDrawer, activeStatus, handleNext]);

  if (!isOpen || !activeGroup || !activeStatus) return null;

  const isMine = activeStatus.userId === currentUser?.id;

  const handlePrev = () => {
    if (currentStatusIdx > 0) {
      setCurrentStatusIdx((prev) => prev - 1);
      setProgress(0);
    } else if (currentUserIdx > 0) {
      setCurrentUserIdx((prev) => prev - 1);
      const prevGroup = statusGroups[currentUserIdx - 1];
      setCurrentStatusIdx(prevGroup.statuses.length - 1);
      setProgress(0);
    }
  };

  const handleDeleteStatus = async () => {
    try {
      await api.delete(`/api/status/${activeStatus.id}`);
      if (onStatusDeleted) onStatusDeleted();
      if (activeGroup.statuses.length === 1) {
        onClose();
      } else {
        handleNext();
      }
    } catch (err) {
      console.error('Failed to delete status:', err);
    }
  };

  const handleSendReply = (e) => {
    e.preventDefault();
    if (!replyText.trim() || !onReplyToStatus) return;
    onReplyToStatus(activeGroup.userId, `[Status Reply]: ${replyText.trim()} (${activeStatus.caption || activeStatus.mediaType})`);
    setReplyText('');
    onClose();
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 select-none animate-fadeIn">
      {/* Center Container simulating WhatsApp Mobile Story View */}
      <div
        className="relative w-full max-w-md h-full md:h-[90vh] md:rounded-3xl bg-slate-950 flex flex-col justify-between overflow-hidden shadow-2xl border border-slate-800"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Top Header Controls & Progress Bars */}
        <div className="absolute top-0 inset-x-0 z-20 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent space-y-3">
          {/* Segmented Progress Bars */}
          <div className="flex gap-1.5 w-full">
            {activeGroup.statuses.map((st, idx) => {
              let fill = '0%';
              if (idx < currentStatusIdx) fill = '100%';
              else if (idx === currentStatusIdx) fill = `${progress}%`;
              return (
                <div key={st.id} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-75 ease-linear"
                    style={{ width: fill }}
                  />
                </div>
              );
            })}
          </div>

          {/* User Info Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full overflow-hidden border-2 border-emerald-400 bg-slate-800 shrink-0">
                {activeGroup.userAvatar ? (
                  <img src={activeGroup.userAvatar} alt={activeGroup.userName} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-bold text-white">
                    {activeGroup.userName.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-white drop-shadow">{activeGroup.userName}</p>
                <p className="text-[10px] text-slate-300 font-semibold">{formatTime(activeStatus.createdAt)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isMine && (
                <button
                  onClick={handleDeleteStatus}
                  className="p-2 text-rose-400 hover:bg-white/10 rounded-full text-xs font-bold transition"
                  title="Delete Status"
                >
                  🗑️
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 text-white/80 hover:bg-white/10 rounded-full text-sm font-bold transition"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        {/* Story Content View Area */}
        <div className="relative flex-1 flex items-center justify-center w-full h-full bg-slate-950">
          {activeStatus.mediaType === 'text' ? (
            <div className={`w-full h-full bg-gradient-to-br ${activeStatus.backgroundColor} flex items-center justify-center p-8 text-center`}>
              <p className="text-2xl md:text-3xl font-extrabold text-white drop-shadow-lg leading-relaxed">
                {activeStatus.caption}
              </p>
            </div>
          ) : activeStatus.mediaType === 'video' ? (
            <video
              ref={videoRef}
              src={activeStatus.mediaUrl}
              autoPlay
              playsInline
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <img
              src={activeStatus.mediaUrl}
              alt="Status content"
              className="max-h-full max-w-full object-contain"
            />
          )}

          {/* Left/Right Tap Overlay Zones */}
          <div className="absolute inset-y-0 left-0 w-1/3 z-10 cursor-pointer" onClick={handlePrev} />
          <div className="absolute inset-y-0 right-0 w-2/3 z-10 cursor-pointer" onClick={handleNext} />
        </div>

        {/* Bottom Caption & Reply Bar */}
        <div className="relative z-20 p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent space-y-3">
          {activeStatus.caption && activeStatus.mediaType !== 'text' && (
            <p className="text-sm font-medium text-white text-center drop-shadow px-2">
              {activeStatus.caption}
            </p>
          )}

          {!isMine ? (
            <form onSubmit={handleSendReply} className="flex items-center gap-2">
              <input
                type="text"
                placeholder={`Reply to ${activeGroup.userName}...`}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onFocus={() => setIsPaused(true)}
                onBlur={() => setIsPaused(false)}
                className="flex-1 rounded-full bg-white/10 border border-white/20 px-4 py-2 text-xs text-white placeholder-white/60 focus:outline-none focus:border-emerald-400 backdrop-blur"
              />
              <button
                type="submit"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-slate-950 font-bold text-xs shadow hover:bg-emerald-400 transition"
              >
                ➔
              </button>
            </form>
          ) : (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setShowViewsDrawer(!showViewsDrawer)}
                className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-white transition"
              >
                👁️ {activeStatus.views?.length || 0} Views
              </button>
            </div>
          )}
        </div>

        {/* Viewers List Drawer for My Status */}
        {showViewsDrawer && isMine && (
          <div className="absolute inset-x-0 bottom-0 z-30 max-h-[50%] bg-slate-900 border-t border-slate-800 p-4 rounded-t-3xl overflow-y-auto space-y-2 animate-slideUp">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                Viewed by ({activeStatus.views?.length || 0})
              </h4>
              <button onClick={() => setShowViewsDrawer(false)} className="text-slate-400 text-xs font-bold">
                ✕
              </button>
            </div>
            {activeStatus.views?.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No views yet.</p>
            ) : (
              activeStatus.views.map((v, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-800/50">
                  <span className="font-bold text-slate-200">{v.userName || 'User'}</span>
                  <span className="text-[10px] text-slate-400">{formatTime(v.viewedAt)}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
