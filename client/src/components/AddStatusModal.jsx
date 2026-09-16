import React, { useState, useRef } from 'react';
import api from '../services/api';

const BG_GRADIENTS = [
  { name: 'Purple-Indigo', class: 'from-purple-600 to-indigo-600' },
  { name: 'Emerald-Teal', class: 'from-emerald-600 to-teal-600' },
  { name: 'Rose-Pink', class: 'from-rose-600 to-pink-600' },
  { name: 'Amber-Orange', class: 'from-amber-600 to-orange-600' },
  { name: 'Cyan-Blue', class: 'from-cyan-600 to-blue-600' },
  { name: 'Dark Slate', class: 'from-slate-800 to-slate-950' },
];

export default function AddStatusModal({ isOpen, onClose, onStatusPosted }) {
  const [activeTab, setActiveTab] = useState('media'); // 'media' | 'text'
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [fileType, setFileType] = useState('image'); // 'image' | 'video'
  const [caption, setCaption] = useState('');
  const [textContent, setTextContent] = useState('');
  const [selectedBg, setSelectedBg] = useState(BG_GRADIENTS[0].class);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (selectedFile.size > 50 * 1024 * 1024) {
      setErrorMsg('File size must be under 50MB');
      return;
    }

    setErrorMsg('');
    setFile(selectedFile);
    const isVideo = selectedFile.type.startsWith('video/') || selectedFile.name.match(/\.(mp4|webm|mov|mkv)$/i);
    setFileType(isVideo ? 'video' : 'image');

    const previewUrl = URL.createObjectURL(selectedFile);
    setFilePreview(previewUrl);
  };

  const handleClearFile = () => {
    setFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      let uploadedMediaUrl = '';

      if (activeTab === 'media') {
        if (!file) {
          setErrorMsg('Please select a photo or video to upload.');
          setIsSubmitting(false);
          return;
        }

        const formData = new FormData();
        formData.append('file', file);
        const { data: uploadData } = await api.post('/api/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        uploadedMediaUrl = uploadData.url;
      } else {
        if (!textContent.trim()) {
          setErrorMsg('Please enter status text.');
          setIsSubmitting(false);
          return;
        }
      }

      const payload = {
        mediaUrl: uploadedMediaUrl,
        mediaType: activeTab === 'text' ? 'text' : fileType,
        caption: activeTab === 'media' ? caption.trim() : textContent.trim(),
        backgroundColor: selectedBg,
      };

      await api.post('/api/status', payload);
      onStatusPosted();
      onClose();
      handleClearFile();
      setCaption('');
      setTextContent('');
    } catch (err) {
      console.error('Post status error:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to post status update.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-emerald-500/30 p-6 text-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-lg font-bold text-emerald-400">Create WhatsApp Status</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex rounded-xl bg-slate-800 p-1 mb-5">
          <button
            type="button"
            onClick={() => setActiveTab('media')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
              activeTab === 'media' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            📸 Photo / Video
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('text')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
              activeTab === 'text' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            🎨 Text Status
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-400 font-bold">
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {activeTab === 'media' ? (
            <div>
              {!filePreview ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center border-2 border-dashed border-emerald-500/30 rounded-2xl p-8 cursor-pointer hover:border-emerald-400 transition bg-slate-950/40"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 mb-3">
                    📸
                  </div>
                  <p className="text-sm font-bold text-slate-200">Click to select photo or video</p>
                  <p className="text-xs text-slate-400 mt-1">Supports JPG, PNG, GIF, MP4, WebM (Max 50MB)</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="relative rounded-2xl overflow-hidden bg-black max-h-64 flex items-center justify-center border border-slate-800">
                  {fileType === 'video' ? (
                    <video src={filePreview} controls className="max-h-64 w-full object-contain" />
                  ) : (
                    <img src={filePreview} alt="Preview" className="max-h-64 w-full object-contain" />
                  )}
                  <button
                    type="button"
                    onClick={handleClearFile}
                    className="absolute top-3 right-3 bg-slate-950/80 hover:bg-rose-600 text-white rounded-full p-2 text-xs font-bold transition shadow"
                  >
                    ✕ Change
                  </button>
                </div>
              )}

              <div className="mt-4">
                <label className="block text-xs font-bold text-slate-300 mb-1">Caption (Optional)</label>
                <input
                  type="text"
                  placeholder="Add a caption..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-400"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div
                className={`w-full h-48 rounded-2xl bg-gradient-to-br ${selectedBg} p-6 flex items-center justify-center text-center shadow-inner relative`}
              >
                <textarea
                  placeholder="Type a status..."
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  maxLength={250}
                  className="w-full bg-transparent text-white font-extrabold text-xl text-center focus:outline-none resize-none placeholder-white/60 drop-shadow"
                  rows={4}
                />
                <span className="absolute bottom-2 right-3 text-[10px] font-bold text-white/70">
                  {250 - textContent.length} left
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">Background Style</label>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {BG_GRADIENTS.map((bg) => (
                    <button
                      key={bg.name}
                      type="button"
                      onClick={() => setSelectedBg(bg.class)}
                      className={`h-9 w-9 shrink-0 rounded-full bg-gradient-to-br ${bg.class} border-2 transition transform hover:scale-105 ${
                        selectedBg === bg.class ? 'border-white scale-110 shadow-lg' : 'border-transparent'
                      }`}
                      title={bg.name}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-lg shadow-emerald-500/20 transition transform active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? 'Posting Status...' : 'Post Status'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
