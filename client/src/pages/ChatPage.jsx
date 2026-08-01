import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../services/api.js';

const defaultSocketUrl = 'https://chatverse-w6fc.onrender.com';
const socketUrl = import.meta.env.VITE_SOCKET_URL || import.meta.env.SOCKET_URL || import.meta.env.VITE_API_URL || import.meta.env.API_URL || defaultSocketUrl;

function formatTime(value) {
  if (!value) {
    return '';
  }

  return new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatBytes(bytes) {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatLastSeen(dateString) {
  if (!dateString) return 'Offline';
  const date = new Date(dateString);
  const now = new Date();

  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const timeString = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (diffDays === 0) {
    if (now.getDate() === date.getDate()) {
      return `Last seen today at ${timeString}`;
    }
  }

  if (diffDays === 1 || (diffDays === 0 && now.getDate() !== date.getDate())) {
    return `Last seen yesterday at ${timeString}`;
  }

  if (diffDays < 7) {
    const weekday = date.toLocaleDateString([], { weekday: 'long' });
    return `Last seen on ${weekday} at ${timeString}`;
  }

  return `Last seen on ${date.toLocaleDateString()} at ${timeString}`;
}

const colorAccents = [
  'text-cyan-400',
  'text-rose-400',
  'text-emerald-400',
  'text-amber-400',
  'text-fuchsia-400',
  'text-violet-400',
  'text-sky-400',
  'text-orange-400',
];

function getUserColor(userId) {
  if (!userId) return 'text-cyan-400';
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash % colorAccents.length);
  return colorAccents[index];
}

const activeConversationClass = 'border-cyan-500/35 bg-cyan-500/10 shadow-lg shadow-cyan-950/5';
const hoverUnactiveClass = 'border-white/5 bg-slate-900/10 hover:border-cyan-500/30 hover:bg-cyan-500/5';

export default function ChatPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const typingTimerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const activeConversationIdRef = useRef(null);
  const fileInputRef = useRef(null);

  const [contacts, setContacts] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUserId, setTypingUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Group creation modal state
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedGroupContacts, setSelectedGroupContacts] = useState([]);

  // Delete Chat modal state
  const [conversationToDelete, setConversationToDelete] = useState(null);

  // Group settings state
  const [isGroupSettingsOpen, setIsGroupSettingsOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [groupMemberIds, setGroupMemberIds] = useState([]);
  
  // File uploads and view state
  const [isUploading, setIsUploading] = useState(false);
  const [lightboxImageUrl, setLightboxImageUrl] = useState(null);

  // Quote replies
  const [replyingToMessage, setReplyingToMessage] = useState(null);

  // Message Actions Dropdown Menu state
  const [activeMenuMessageId, setActiveMenuMessageId] = useState(null);

  // Dark/Light theme state
  const [darkTheme, setDarkTheme] = useState(() => localStorage.getItem('theme') !== 'light');

  // Pinned Chats
  const [pinnedConversationIds, setPinnedConversationIds] = useState(() => {
    try {
      const saved = localStorage.getItem(`pinned_chats_${user?.id}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const toggleTheme = () => {
    const newTheme = !darkTheme;
    setDarkTheme(newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
  };

  useEffect(() => {
    if (user) {
      localStorage.setItem(`pinned_chats_${user.id}`, JSON.stringify(pinnedConversationIds));
    }
  }, [pinnedConversationIds, user]);

  const togglePinConversation = (e, conversationId) => {
    e.stopPropagation();
    if (pinnedConversationIds.includes(conversationId)) {
      setPinnedConversationIds(pinnedConversationIds.filter((id) => id !== conversationId));
    } else {
      setPinnedConversationIds([...pinnedConversationIds, conversationId]);
    }
  };

  const sortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => {
      const aPinned = pinnedConversationIds.includes(a.id);
      const bPinned = pinnedConversationIds.includes(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
  }, [conversations, pinnedConversationIds]);

  const onlineContacts = useMemo(() => {
    return contacts.filter((contact) => {
      const isOnline = onlineUsers.includes(contact.id);
      if (!isOnline) return false;

      const hasConversation = conversations.some((conv) =>
        !conv.isGroup && conv.participants.some((p) => p.id === contact.id)
      );
      return !hasConversation;
    });
  }, [contacts, onlineUsers, conversations]);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) || null,
    [activeConversationId, conversations],
  );

  useEffect(() => {
    setIsGroupSettingsOpen(false);
    if (activeConversation && activeConversation.isGroup) {
      setNewGroupName(activeConversation.name || '');
      setGroupMemberIds(activeConversation.participants.map((p) => p.id));
    } else {
      setNewGroupName('');
      setGroupMemberIds([]);
    }
  }, [activeConversation]);

  const pinnedMessages = useMemo(() => {
    return messages.filter((msg) => msg.isPinned);
  }, [messages]);
  
  const recipient = useMemo(() => {
    if (!activeConversation || activeConversation.isGroup) {
      return null;
    }
    return activeConversation.participants.find((participant) => participant.id !== user?.id) || null;
  }, [activeConversation, user]);

  const groupParticipantsSummary = useMemo(() => {
    if (!activeConversation || !activeConversation.isGroup) {
      return '';
    }
    return activeConversation.participants
      .map((p) => (p.id === user?.id ? 'You' : p.name))
      .join(', ');
  }, [activeConversation, user]);

  const refreshContacts = async () => {
    try {
      const { data } = await api.get('/api/users');
      setContacts(data);
    } catch (error) {
      setErrorMessage('Unable to refresh contacts.');
    }
  };

  const filteredContacts = useMemo(() => {
    const lowerSearch = search.toLowerCase();
    const filtered = contacts.filter((contact) => {
      if (!lowerSearch) {
        return true;
      }

      return contact.name.toLowerCase().includes(lowerSearch) || contact.email.toLowerCase().includes(lowerSearch);
    });

    return [...filtered].sort((a, b) => {
      const aOnline = onlineUsers.includes(a.id);
      const bOnline = onlineUsers.includes(b.id);
      if (aOnline && !bOnline) return -1;
      if (!aOnline && bOnline) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [contacts, search, onlineUsers]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const loadConversations = async () => {
      setLoading(true);
      try {
        const [{ data: conversationData }] = await Promise.all([
          api.get('/api/conversations'),
        ]);

        setConversations(conversationData);
        await refreshContacts();

        if (conversationData.length > 0) {
          setActiveConversationId(conversationData[0].id);
        }
      } catch (error) {
        setErrorMessage('Unable to refresh chats right now.');
      } finally {
        setLoading(false);
      }
    };

    loadConversations();
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    console.log('[ChatPage] socket effect mount', { userId: user?.id });
    const socket = io(socketUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 6,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
      setErrorMessage('');
      socket.emit('authenticate', { token: localStorage.getItem('token') });
      if (activeConversationIdRef.current) {
        socket.emit('join_conversation', activeConversationIdRef.current);
      }
      void refreshContacts();
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
      setErrorMessage('Connection lost. Reconnecting…');
    });

    socket.on('connect_error', () => {
      setErrorMessage('Unable to connect to the chat server.');
    });

    socket.on('presence_update', (payload) => {
      setOnlineUsers(payload.onlineUserIds || []);

      if (payload.userId && payload.lastSeen) {
        setConversations((previous) =>
          previous.map((conv) => {
            if (!conv.isGroup) {
              return {
                ...conv,
                participants: conv.participants.map((p) =>
                  p.id === payload.userId ? { ...p, lastSeen: payload.lastSeen } : p
                ),
              };
            }
            return conv;
          })
        );
        setContacts((previous) =>
          previous.map((contact) =>
            contact.id === payload.userId ? { ...contact, lastSeen: payload.lastSeen } : contact
          )
        );
      }

      void refreshContacts();
    });

    socket.on('new_message', (message) => {
      console.log('[ChatPage] socket new_message received', message);
      const conversationId = message.conversationId;

      if (conversationId === activeConversationIdRef.current) {
        setMessages((previous) => {
          if (previous.some((entry) => entry.id === message.id)) {
            return previous;
          }
          return [...previous, message];
        });
        
        socket.emit('mark_read', { conversationId });
      }

      setConversations((previous) => {
        const exists = previous.some((conversation) => conversation.id === conversationId);
        if (exists) {
          return previous.map((conversation) =>
            conversation.id === conversationId
              ? { ...conversation, lastMessage: message, updatedAt: message.createdAt }
              : conversation,
          );
        } else {
          api.get('/api/conversations')
            .then(({ data }) => setConversations(data))
            .catch(() => {});
          return previous;
        }
      });
    });

    socket.on('message_read', ({ conversationId, messageIds }) => {
      if (conversationId === activeConversationIdRef.current) {
        setMessages((previous) =>
          previous.map((message) =>
            messageIds.includes(message.id)
              ? { ...message, readAt: new Date().toISOString() }
              : message,
          ),
        );
      }
    });

    socket.on('typing_update', ({ conversationId, userId, isTyping }) => {
      if (conversationId !== activeConversationIdRef.current) {
        return;
      }

      if (isTyping && userId !== user?.id) {
        setTypingUserId(userId);
      } else {
        setTypingUserId(null);
      }
    });

    socket.on('message_deleted', ({ messageId, conversationId, deleteType }) => {
      if (conversationId === activeConversationIdRef.current) {
        setMessages((previous) => previous.filter((msg) => msg.id !== messageId));
      }
      setConversations((previous) =>
        previous.map((conv) => {
          if (conv.id === conversationId && conv.lastMessage?.id === messageId) {
            api.get('/api/conversations')
              .then(({ data }) => setConversations(data))
              .catch(() => {});
          }
          return conv;
        })
      );
    });

    socket.on('conversation_deleted', ({ conversationId }) => {
      setConversations((previous) => previous.filter((conv) => conv.id !== conversationId));
      setPinnedConversationIds((previous) => previous.filter((id) => id !== conversationId));
      if (activeConversationIdRef.current === conversationId) {
        setActiveConversationId(null);
      }
    });

    socket.on('group_updated', (updatedConv) => {
      const isParticipant = updatedConv.participants.some((p) => p.id === user?.id);

      if (!isParticipant) {
        setConversations((previous) => previous.filter((conv) => conv.id !== updatedConv.id));
        if (activeConversationIdRef.current === updatedConv.id) {
          setActiveConversationId(null);
        }
      } else {
        setConversations((previous) =>
          previous.map((conv) => (conv.id === updatedConv.id ? updatedConv : conv))
        );
      }
    });

    socket.on('message_pinned_update', ({ messageId, conversationId, isPinned }) => {
      if (conversationId === activeConversationIdRef.current) {
        setMessages((previous) =>
          previous.map((msg) => (msg.id === messageId ? { ...msg, isPinned } : msg))
        );
      }
    });

    return () => {
      console.log('[ChatPage] socket effect cleanup', { userId: user?.id });
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [user]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
    setReplyingToMessage(null);
    setActiveMenuMessageId(null);

    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      try {
        const { data } = await api.get(`/api/conversations/${activeConversationId}/messages`);
        setMessages(data);
        socketRef.current?.emit('join_conversation', activeConversationId);
        socketRef.current?.emit('mark_read', { conversationId: activeConversationId });
      } catch (error) {
        setErrorMessage('Unable to load that conversation history.');
      }
    };

    loadMessages();
  }, [activeConversationId]);

  useEffect(() => {
    if (!activeMenuMessageId) return;

    const handleOutsideClick = (e) => {
      if (!e.target.closest('.message-action-menu') && !e.target.closest('.message-action-trigger')) {
        setActiveMenuMessageId(null);
      }
    };

    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [activeMenuMessageId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUserId]);

  const handleSelectConversation = async (conversation) => {
    setActiveConversationId(conversation.id);
    setErrorMessage('');
  };

  const handleSelectContact = async (contact) => {
    try {
      const { data } = await api.post('/api/conversations', { participantId: contact.id });
      const conversation = data;

      setConversations((previous) => {
        if (previous.some((entry) => entry.id === conversation.id)) {
          return previous;
        }
        return [conversation, ...previous];
      });

      setActiveConversationId(conversation.id);
      setSearch('');
      setErrorMessage('');
    } catch (error) {
      setErrorMessage('Unable to open that conversation.');
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim() || selectedGroupContacts.length === 0) {
      setErrorMessage('Group name and at least one contact are required.');
      return;
    }

    try {
      const { data } = await api.post('/api/conversations/group', {
        name: groupName.trim(),
        participantIds: selectedGroupContacts,
      });

      setConversations((previous) => [data, ...previous]);
      setActiveConversationId(data.id);
      setGroupName('');
      setSelectedGroupContacts([]);
      setIsGroupModalOpen(false);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error.response?.data?.message || 'Failed to create group.');
    }
  };

  const handleDeleteConversation = async (conversationId) => {
    try {
      await api.delete(`/api/conversations/${conversationId}`);
      setConversations((previous) => previous.filter((conv) => conv.id !== conversationId));
      setPinnedConversationIds((previous) => previous.filter((id) => id !== conversationId));
      if (activeConversationId === conversationId) {
        setActiveConversationId(null);
      }
      setConversationToDelete(null);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error.response?.data?.message || 'Failed to delete conversation.');
      setConversationToDelete(null);
    }
  };

  const handleRenameGroup = async () => {
    if (!activeConversation || !newGroupName.trim()) return;

    try {
      const { data } = await api.put(`/api/conversations/${activeConversation.id}`, {
        name: newGroupName.trim(),
      });
      setConversations((previous) =>
        previous.map((conv) => (conv.id === data.id ? data : conv))
      );
      setErrorMessage('');
      setIsGroupSettingsOpen(false);
    } catch (error) {
      setErrorMessage(error.response?.data?.message || 'Failed to rename group.');
    }
  };

  const handleAddMember = async (contactId) => {
    if (!activeConversation) return;

    const updatedIds = [...groupMemberIds, contactId];
    if (user?.id && !updatedIds.includes(user.id)) {
      updatedIds.push(user.id);
    }

    try {
      const { data } = await api.put(`/api/conversations/${activeConversation.id}`, {
        participantIds: updatedIds,
      });
      setGroupMemberIds(data.participants.map((p) => p.id));
      setConversations((previous) =>
        previous.map((conv) => (conv.id === data.id ? data : conv))
      );
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error.response?.data?.message || 'Failed to add member.');
    }
  };

  const handleRemoveMember = async (contactId) => {
    if (!activeConversation) return;

    const updatedIds = groupMemberIds.filter((id) => id !== contactId);
    if (user?.id && !updatedIds.includes(user.id)) {
      updatedIds.push(user.id);
    }

    try {
      const { data } = await api.put(`/api/conversations/${activeConversation.id}`, {
        participantIds: updatedIds,
      });
      setGroupMemberIds(data.participants.map((p) => p.id));
      setConversations((previous) =>
        previous.map((conv) => (conv.id === data.id ? data : conv))
      );
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error.response?.data?.message || 'Failed to remove member.');
    }
  };

  const handleSendMessage = (event) => {
    event.preventDefault();

    const text = draft.trim();
    const isGroup = activeConversation?.isGroup;

    if (!text || !activeConversationId) {
      return;
    }

    if (!isGroup && !recipient) {
      return;
    }

    setDraft('');
    setTypingUserId(null);

    const payload = {
      conversationId: activeConversationId,
      recipientId: recipient?.id || null,
      text,
      replyToMessageId: replyingToMessage ? replyingToMessage.id : null,
    };

    setReplyingToMessage(null);

    socketRef.current?.emit('send_message', payload, (message) => {
      if (!message) {
        setErrorMessage('Your message did not reach the server.');
      }
    });
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsUploading(true);
    setErrorMessage('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const { data } = await api.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const payload = {
        conversationId: activeConversationId,
        recipientId: recipient?.id || null,
        text: '',
        fileUrl: data.url,
        fileName: data.filename,
        fileType: data.mimeType,
        fileSize: data.size,
        replyToMessageId: replyingToMessage ? replyingToMessage.id : null,
      };

      setReplyingToMessage(null);

      socketRef.current?.emit('send_message', payload, (message) => {
        if (!message) {
          setErrorMessage('Unable to send attachment.');
        }
      });
    } catch (error) {
      setErrorMessage(error.response?.data?.message || 'File upload failed.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleTyping = (value) => {
    setDraft(value);

    if (!socketRef.current || !activeConversationId) {
      return;
    }

    socketRef.current.emit('typing', {
      conversationId: activeConversationId,
      isTyping: Boolean(value.trim()),
    });

    if (typingTimerRef.current) {
      window.clearTimeout(typingTimerRef.current);
    }

    typingTimerRef.current = window.setTimeout(() => {
      socketRef.current?.emit('typing', {
        conversationId: activeConversationId,
        isTyping: false,
      });
    }, 1200);
  };

  const handleQuoteClick = (quotedMsgId) => {
    const element = document.getElementById(`msg-${quotedMsgId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('ring-2', 'ring-cyan-400', 'ring-offset-2', 'transition-all');
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-cyan-400', 'ring-offset-2');
      }, 1200);
    }
  };

  const handlePinMessage = (messageId) => {
    socketRef.current?.emit('toggle_pin_message', { messageId }, (res) => {
      if (!res?.success) {
        setErrorMessage(res?.message || 'Failed to toggle pin on message.');
      }
    });
    setActiveMenuMessageId(null);
  };

  const handleDeleteMessage = (messageId, deleteType) => {
    socketRef.current?.emit('delete_message', { messageId, deleteType }, (res) => {
      if (!res?.success) {
        setErrorMessage(res?.message || 'Failed to delete message.');
      }
    });
    setActiveMenuMessageId(null);
  };

  const handleCopyMessage = (text) => {
    if (!text) return;

    const showCopySuccess = () => {
      setActiveMenuMessageId(null);
      setErrorMessage('Message copied to clipboard.');
      setTimeout(() => {
        setErrorMessage('');
      }, 2000);
    };

    const fallbackCopy = (val) => {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = val;
        textArea.style.top = '0';
        textArea.style.left = '0';
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (successful) {
          showCopySuccess();
        } else {
          setErrorMessage('Unable to copy text.');
        }
      } catch (err) {
        console.error('Fallback copy failed', err);
        setErrorMessage('Unable to copy text.');
      }
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text)
        .then(() => showCopySuccess())
        .catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  };

  const activeTypingUser = useMemo(() => {
    if (!typingUserId || !activeConversation) return null;
    return activeConversation.participants.find((p) => p.id === typingUserId) || null;
  }, [typingUserId, activeConversation]);

  // Styling variable bindings based on active light/dark theme
  const outerWrapperClass = darkTheme
    ? 'bg-[radial-gradient(circle_at_top,_rgba(6,182,212,0.12),_transparent_40%)] bg-slate-950 text-slate-100'
    : 'bg-[radial-gradient(circle_at_top,_rgba(6,182,212,0.06),_transparent_40%)] bg-slate-50 text-slate-900';

  const containerGlowClass = darkTheme
    ? 'glass-panel-glow text-slate-100'
    : 'bg-white/95 border border-slate-200 shadow-2xl shadow-slate-300/40 text-slate-900';

  const sidebarClass = darkTheme
    ? 'bg-slate-950/40 border-r border-white/5'
    : 'bg-slate-50/50 border-r border-slate-200/80';

  const sidebarHeaderClass = darkTheme
    ? 'border-b border-white/5'
    : 'border-b border-slate-200/80 bg-slate-50/20';

  const chatHeaderClass = darkTheme
    ? 'border-b border-white/5 bg-slate-900/40'
    : 'border-b border-slate-200/80 bg-white/60';

  const chatFooterClass = darkTheme
    ? 'border-t border-white/5 bg-slate-900/40'
    : 'border-t border-slate-200/80 bg-white/60';

  const inputAreaClass = darkTheme
    ? 'border-white/5 bg-slate-950/60 text-white'
    : 'border-slate-200 bg-slate-100 text-slate-900 focus-within:border-cyan-400';

  return (
    <div className={`min-h-screen transition-colors duration-300 p-2 sm:p-4 md:p-6 flex items-center justify-center ${outerWrapperClass}`}>
      <div className={`w-full max-w-7xl h-[calc(100vh-2rem)] sm:h-[calc(100vh-3rem)] md:h-[880px] rounded-3xl overflow-hidden flex flex-col transition-all duration-300 ${containerGlowClass}`}>
        
        {/* Main Interface Layout */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* Sidebar */}
          <aside className={`w-full lg:w-[380px] flex flex-col shrink-0 transition-all ${sidebarClass} ${activeConversationId ? 'hidden lg:flex' : 'flex'}`}>
            {/* Sidebar Top Header */}
            <div className={`p-5 ${sidebarHeaderClass}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-cyan-400">Chat-Verse</p>
                  <h2 className="mt-1 text-2xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-cyan-600 bg-clip-text text-transparent">{user?.name}</h2>
                </div>
                <div className="flex gap-2">
                  {/* Theme Switcher Toggle */}
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="rounded-full border border-white/5 bg-slate-900/10 p-2 transition hover:border-cyan-500 hover:bg-cyan-500/10"
                    title={darkTheme ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
                  >
                    {darkTheme ? (
                      <svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m2.828 9.9a5 5 0 117.072 0l-.707-.707" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                      </svg>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage('');
                      setIsGroupModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border border-cyan-500/20 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-50 hover:text-white transition duration-300"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Group
                  </button>

                  <Link to="/profile" className="rounded-full border border-white/5 bg-slate-900/10 p-2 text-slate-400 transition hover:border-cyan-500 hover:text-cyan-500 hover:bg-cyan-500/10">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      navigate('/auth');
                    }}
                    className="rounded-full border border-white/5 bg-slate-900/10 p-2 text-rose-400 transition hover:border-rose-500/50 hover:bg-rose-500/10"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Online indicator count */}
              <div className="mt-5 flex items-center justify-between">
                <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${darkTheme ? 'text-slate-400' : 'text-slate-500'}`}>Conversations list</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold flex items-center gap-1.5 border transition ${darkTheme ? 'bg-emerald-500/10 border-emerald-500/10 text-emerald-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  {onlineUsers.length} online
                </span>
              </div>
              
              <div className="mt-3 relative">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className={`w-full rounded-2xl border pl-10 pr-4 py-2.5 text-sm outline-none transition focus:border-cyan-500/50 ${
                    darkTheme ? 'border-white/5 bg-slate-900/75 text-white' : 'border-slate-200 bg-slate-100 text-slate-900'
                  }`}
                  placeholder="Search users to chat or create groups..."
                />
                <svg className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Contacts Search pane */}
            {search && (
              <div className={`p-3 border-b max-h-56 overflow-y-auto ${darkTheme ? 'border-white/5 bg-slate-900/30' : 'border-slate-200 bg-slate-100/50'}`}>
                <p className="px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Contacts</p>
                <div className="space-y-1">
                  {filteredContacts.length === 0 ? (
                    <p className="text-xs text-slate-500 p-2">No users found.</p>
                  ) : (
                    filteredContacts.map((contact) => {
                      const isOnline = onlineUsers.includes(contact.id);
                      return (
                        <button
                          key={contact.id}
                          type="button"
                          onClick={() => handleSelectContact(contact)}
                          className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition hover:bg-cyan-500/5"
                        >
                          <div className="relative">
                            {contact.avatarUrl ? (
                              <img src={contact.avatarUrl} alt={contact.name} className="h-9 w-9 rounded-full object-cover border border-cyan-500/20" />
                            ) : (
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-500/20 font-semibold text-cyan-200 text-sm">
                                {contact.name.slice(0, 1).toUpperCase()}
                              </div>
                            )}
                            {isOnline && <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ${darkTheme ? 'ring-slate-950' : 'ring-white'}`} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold">{contact.name}</p>
                            <p className="truncate text-[10px] text-slate-400">{contact.status || 'Hey there! I am using Chat-Verse.'}</p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Conversations list with sorting */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              
              {/* Online Now list */}
              {!search && !loading && onlineContacts.length > 0 && (
                <div className="mb-6 space-y-2">
                  <p className="px-2 text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-2.5">Online Now</p>
                  {onlineContacts.map((contact) => (
                    <div
                      key={contact.id}
                      onClick={() => handleSelectContact(contact)}
                      className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition duration-300 relative group/item cursor-pointer ${
                        darkTheme
                          ? 'border-emerald-500/10 bg-emerald-500/5 hover:bg-emerald-500/10'
                          : 'border-emerald-500/20 bg-emerald-50/40 hover:bg-emerald-100/40'
                      }`}
                    >
                      <div className="relative">
                        {contact.avatarUrl ? (
                          <img src={contact.avatarUrl} alt={contact.name} className="h-11 w-11 rounded-full object-cover border border-emerald-500/20" />
                        ) : (
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/20 font-semibold text-emerald-300 text-sm">
                            {contact.name.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-slate-900" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{contact.name}</p>
                        <p className="truncate text-xs text-slate-400 mt-1">{contact.status || 'Hey there! I am using Chat-Verse.'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="px-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Chats</p>
              
              {loading && (
                <div className="space-y-3 p-4">
                  <div className="h-10 bg-slate-500/5 rounded-2xl animate-pulse" />
                  <div className="h-10 bg-slate-500/5 rounded-2xl animate-pulse" />
                </div>
              )}
              
              {!loading && conversations.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-10">Choose a user from contacts list to start.</p>
              )}

              {sortedConversations.map((conversation) => {
                const participant = conversation.participants.find((p) => p.id !== user?.id);
                const isOnline = !conversation.isGroup && onlineUsers.includes(participant?.id);
                const isActive = activeConversationId === conversation.id;
                const isPinned = pinnedConversationIds.includes(conversation.id);

                let lastMsgText = 'Tap to open chat';
                if (conversation.lastMessage) {
                  const prefix = conversation.isGroup
                    ? `${conversation.participants.find((p) => p.id === conversation.lastMessage.senderId)?.name || 'User'}: `
                    : '';
                  lastMsgText = conversation.lastMessage.fileUrl
                    ? `${prefix}📎 Attachment`
                    : `${prefix}${conversation.lastMessage.text}`;
                }

                return (
                  <div
                    key={conversation.id}
                    onClick={() => handleSelectConversation(conversation)}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition duration-300 relative group/item cursor-pointer ${
                      isActive ? activeConversationClass : hoverUnactiveClass
                    }`}
                  >
                    <div className="relative">
                      {conversation.isGroup ? (
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-cyan-950/80 border border-cyan-500/20 text-cyan-300 font-semibold shadow-inner">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                      ) : participant?.avatarUrl ? (
                        <img src={participant.avatarUrl} alt={participant.name} className="h-11 w-11 rounded-full object-cover border border-white/10" />
                      ) : (
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-800 border border-white/5 font-semibold text-white">
                          {(participant?.avatar || participant?.name?.slice(0, 1) || 'U').toUpperCase()}
                        </div>
                      )}
                      {isOnline && <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-400 ring-2 ${darkTheme ? 'ring-slate-900' : 'ring-white'}`} />}
                    </div>
                    <div className="min-w-0 flex-1 pr-14">
                      <div className="flex items-center justify-between">
                        <p className="truncate text-sm font-semibold">
                          {conversation.isGroup ? conversation.name : (participant?.name || 'Private Chat')}
                        </p>
                        <span className="text-[10px] text-slate-400">
                          {formatTime(conversation.updatedAt)}
                        </span>
                      </div>
                      <p className="truncate text-xs text-slate-400 mt-1">{lastMsgText}</p>
                    </div>

                    {/* Chat Action Buttons */}
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      {isPinned ? (
                        <button
                          type="button"
                          onClick={(e) => togglePinConversation(e, conversation.id)}
                          className="text-cyan-500 hover:text-cyan-400 transition"
                          title="Unpin Chat"
                        >
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v3.586l2.707 2.707A1 1 0 0117 12h-2v5a2 2 0 01-2 2H7a2 2 0 01-2-2v-5H3a1 1 0 01-.707-1.707L5 7.586V4z" />
                          </svg>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => togglePinConversation(e, conversation.id)}
                          className="opacity-100 lg:opacity-0 lg:group-hover/item:opacity-100 text-slate-400 hover:text-cyan-500 transition duration-200"
                          title="Pin Chat"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v3.586l.707.707A1 1 0 0120 10H4a1 1 0 01-.707-1.707L4 7.586V5z" />
                          </svg>
                        </button>
                      )}

                      {/* Delete Chat Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConversationToDelete(conversation);
                        }}
                        className="opacity-100 lg:opacity-0 lg:group-hover/item:opacity-100 text-slate-400 hover:text-rose-500 transition duration-200"
                        title="Delete Chat"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          {/* Active Chat Section */}
          <main className={`flex flex-1 flex-col bg-slate-950/5 ${activeConversationId ? 'flex' : 'hidden lg:flex'}`}>
            {activeConversation ? (
              <>
                {/* Active Chat Header */}
                <header className={`flex items-center justify-between px-5 py-4 shrink-0 backdrop-blur-md transition-colors ${chatHeaderClass}`}>
                  <div className="min-w-0 flex items-center gap-2 sm:gap-3">
                    {/* Back Button on Mobile */}
                    <button
                      type="button"
                      onClick={() => setActiveConversationId(null)}
                      className="p-1 rounded-full hover:bg-slate-900/10 dark:hover:bg-white/10 lg:hidden text-slate-400 hover:text-cyan-400 transition mr-1"
                      title="Back to Chats list"
                    >
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>

                    {/* Avatar display */}
                    {!activeConversation.isGroup && (
                      recipient?.avatarUrl ? (
                        <img src={recipient.avatarUrl} alt={recipient.name} className="h-10 w-10 rounded-full object-cover border border-cyan-500/20" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400 font-semibold border border-cyan-500/20">
                          {recipient?.avatar || recipient?.name?.slice(0, 1).toUpperCase()}
                        </div>
                      )
                    )}
                    {activeConversation.isGroup && (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-950 border border-cyan-500/25 text-cyan-300 font-semibold shadow-inner">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-base font-bold truncate">
                          {activeConversation.isGroup ? activeConversation.name : recipient?.name}
                        </p>
                        {activeConversation.isGroup && activeConversation.createdBy === user?.id && (
                          <button
                            type="button"
                            onClick={() => {
                              setErrorMessage('');
                              setIsGroupSettingsOpen(true);
                            }}
                            className="rounded-full hover:bg-slate-900/10 dark:hover:bg-white/10 p-1.5 text-slate-400 hover:text-cyan-400 transition shrink-0"
                            title="Rename & Manage Group"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 truncate leading-relaxed">
                        {activeConversation.isGroup
                          ? `Group participants: ${groupParticipantsSummary}`
                          : (onlineUsers.includes(recipient?.id) ? 'Online' : formatLastSeen(recipient?.lastSeen))}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-400 shadow-sm animate-pulse">
                      {activeTypingUser
                        ? `${activeTypingUser.name} is typing...`
                        : (socketConnected ? 'Secure Workspace' : 'Connecting')}
                    </div>
                  </div>
                </header>

                {errorMessage && (
                  <div className="bg-rose-500/10 border-b border-rose-500/20 px-5 py-2.5 text-xs text-rose-400 font-bold">
                    ⚠️ {errorMessage}
                  </div>
                )}

                {/* Pinned Messages Banner */}
                {pinnedMessages.length > 0 && (
                  <div className={`px-5 py-2.5 flex items-center justify-between border-b transition ${
                    darkTheme ? 'bg-cyan-950/20 border-cyan-500/10' : 'bg-cyan-50 border-cyan-100'
                  }`}>
                    <div
                      className="flex items-center gap-2 cursor-pointer min-w-0"
                      onClick={() => handleQuoteClick(pinnedMessages[0].id)}
                      title="Click to view pinned message"
                    >
                      <svg className="h-4 w-4 text-cyan-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v3.586l2.707 2.707A1 1 0 0117 12h-2v5a2 2 0 01-2 2H7a2 2 0 01-2-2v-5H3a1 1 0 01-.707-1.707L5 7.586V4z" />
                      </svg>
                      <p className={`text-xs truncate font-semibold ${darkTheme ? 'text-cyan-300' : 'text-cyan-700'}`}>
                        Pinned: "{pinnedMessages[0].fileUrl ? '📎 Attachment' : pinnedMessages[0].text}"
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePinMessage(pinnedMessages[0].id)}
                      className={`text-[10px] font-bold uppercase tracking-wider transition ${
                        darkTheme ? 'text-cyan-400 hover:text-cyan-300' : 'text-cyan-600 hover:text-cyan-500'
                      }`}
                    >
                      Unpin
                    </button>
                  </div>
                )}

                {/* Messages Box */}
                <div className={`flex-1 overflow-y-auto p-4 md:p-6 space-y-4 transition ${
                  darkTheme ? 'bg-[radial-gradient(circle_at_bottom,_rgba(6,182,212,0.03),_transparent_55%)]' : 'bg-slate-100/20'
                }`}>
                  {messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-center text-slate-500 text-sm">
                      <div>
                        <p className="font-semibold text-slate-400">Say hello!</p>
                        <p className="text-xs mt-1">This secure conversation has started.</p>
                      </div>
                    </div>
                  ) : (
                    messages.map((message) => {
                      const isMine = message.senderId === user?.id;
                      const isImage = message.fileType?.startsWith('image/');
                      const sender = activeConversation.participants.find((p) => p.id === message.senderId);

                      // Resolve quote message preview
                      const quotedMessage = message.replyToMessageId
                        ? messages.find((m) => m.id === message.replyToMessageId)
                        : null;
                      const quotedSender = quotedMessage
                        ? activeConversation.participants.find((p) => p.id === quotedMessage.senderId)
                        : null;

                      return (
                        <div
                          key={message.id}
                          id={`msg-${message.id}`}
                          className={`flex ${isMine ? 'justify-end' : 'justify-start'} group/msg relative mb-1.5`}
                        >
                          <div className={`flex items-start gap-2 max-w-[80%] md:max-w-[70%]`}>
                            
                            {/* In groups: Render avatar for received messages */}
                            {!isMine && activeConversation.isGroup && (
                              <div className="h-8 w-8 rounded-full shrink-0 overflow-hidden border border-white/10 mt-1 shadow-sm">
                                {sender?.avatarUrl ? (
                                  <img src={sender.avatarUrl} alt={sender.name} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center bg-slate-800 text-xs font-bold text-slate-300">
                                    {(sender?.avatar || sender?.name?.slice(0, 1) || 'U').toUpperCase()}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Message Bubble wrapper with clean corner tail */}
                            <div className={`relative px-4 py-3 shadow-xl transition-all duration-300 hover:shadow-cyan-950/5 ${
                              isMine
                                ? (darkTheme ? 'bg-gradient-to-r from-cyan-600 to-cyan-500 text-white rounded-3xl rounded-tr-none' : 'bg-gradient-to-r from-cyan-500 to-cyan-400 text-white rounded-3xl rounded-tr-none')
                                : (darkTheme ? 'bg-slate-900/80 border border-white/5 text-slate-100 rounded-3xl rounded-tl-none' : 'bg-white border border-slate-200/80 text-slate-900 rounded-3xl rounded-tl-none')
                            }`}>
                              
                              {/* Quoted Reply Panel inside the bubble */}
                              {quotedMessage && (
                                <div
                                  onClick={() => handleQuoteClick(quotedMessage.id)}
                                  className={`mb-2.5 flex flex-col p-2.5 rounded-xl border-l-4 border-cyan-400 text-left text-xs cursor-pointer transition hover:bg-black/10 ${
                                    isMine ? 'bg-slate-950/20 text-cyan-50' : 'bg-slate-100 text-slate-700'
                                  }`}
                                  title="Click to jump to message"
                                >
                                  <p className="font-bold text-cyan-400 text-[10px] tracking-wider uppercase">
                                    {quotedSender?.id === user?.id ? 'You' : (quotedSender?.name || 'User')}
                                  </p>
                                  <p className="truncate mt-1 text-[11px]">
                                    {quotedMessage.fileUrl ? '📎 Attachment' : quotedMessage.text}
                                  </p>
                                </div>
                              )}

                              {/* Sender name label on group messages */}
                              {!isMine && activeConversation.isGroup && (
                                <p className={`text-xs font-bold mb-1 ${getUserColor(message.senderId)}`}>
                                  {sender?.name || 'Member'}
                                </p>
                              )}

                              {/* Attachment: Image */}
                              {message.fileUrl && isImage && (
                                <div
                                  onClick={() => setLightboxImageUrl(message.fileUrl)}
                                  className="mb-2 relative rounded-2xl overflow-hidden cursor-zoom-in group max-w-full"
                                >
                                  <img
                                    src={message.fileUrl}
                                    alt={message.fileName}
                                    className="max-h-64 max-w-full object-cover rounded-2xl transition duration-300 group-hover:scale-102"
                                  />
                                  <div className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition duration-300">
                                    <span className="bg-slate-950/80 px-3 py-1.5 rounded-full text-xs font-semibold text-white flex items-center gap-1.5 border border-white/5 shadow-inner">
                                      Fullscreen
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* Attachment: Document */}
                              {message.fileUrl && !isImage && (
                                <div className="mb-2 flex items-center gap-3 rounded-2xl bg-black/10 border border-white/5 p-3 text-left">
                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400">
                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-bold">{message.fileName}</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">{formatBytes(message.fileSize)}</p>
                                  </div>
                                  <a
                                    href={message.fileUrl}
                                    download={message.fileName}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500 hover:text-white transition duration-300"
                                  >
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                  </a>
                                </div>
                              )}

                              {/* Message Text content */}
                              {message.text && (
                                <p className="text-sm leading-6 break-words">{message.text}</p>
                              )}

                              {/* Footer details (time + pin icon + read tick check) */}
                              <div className={`mt-1.5 flex items-center justify-end gap-1.5 text-[9px] font-semibold ${isMine ? 'text-cyan-100/90' : 'text-slate-400'}`}>
                                {message.isPinned && (
                                  <svg className="h-3 w-3 text-cyan-300 mr-0.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v3.586l2.707 2.707A1 1 0 0117 12h-2v5a2 2 0 01-2 2H7a2 2 0 01-2-2v-5H3a1 1 0 01-.707-1.707L5 7.586V4z" />
                                  </svg>
                                )}
                                <span>{formatTime(message.createdAt)}</span>
                                {isMine && (
                                  <svg
                                    className={`h-4.5 w-4.5 inline-block ${message.readAt ? 'text-cyan-300' : 'text-slate-400/50'}`}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2 12l5 5L18 6" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 17l5 5L22 10" />
                                  </svg>
                                )}
                              </div>

                              {/* Action Buttons overlay: always visible on mobile, hoverable on desktop */}
                              <div className={`absolute top-1/2 -translate-y-1/2 flex items-center gap-1 z-10 transition-opacity duration-200 ${
                                isMine ? '-left-16' : '-right-16'
                              } ${activeMenuMessageId === message.id ? 'opacity-100' : 'opacity-100 lg:opacity-0 lg:group-hover/msg:opacity-100'}`}>
                                <button
                                  type="button"
                                  onClick={() => setReplyingToMessage(message)}
                                  className="p-1 rounded-full bg-slate-900/90 border border-white/10 text-slate-300 hover:text-cyan-400 hover:scale-105 transition message-action-trigger"
                                  title="Reply"
                                >
                                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                  </svg>
                                </button>
                                
                                <button
                                  type="button"
                                  onClick={() => setActiveMenuMessageId(activeMenuMessageId === message.id ? null : message.id)}
                                  className="p-1 rounded-full bg-slate-900/90 border border-white/10 text-slate-300 hover:text-cyan-400 hover:scale-105 transition message-action-trigger"
                                  title="Actions"
                                >
                                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                  </svg>
                                </button>
                              </div>

                              {/* Dropdown Menu */}
                              {activeMenuMessageId === message.id && (
                                <div className={`message-action-menu absolute top-10 z-20 w-40 rounded-2xl border p-1.5 shadow-2xl backdrop-blur-md transition-all ${
                                  darkTheme
                                    ? 'bg-slate-900/95 border-white/10 text-slate-200'
                                    : 'bg-white/95 border-slate-200 text-slate-800'
                                } ${isMine ? 'right-0' : 'left-0'}`}>
                                  {message.text && (
                                    <button
                                      type="button"
                                      onClick={() => handleCopyMessage(message.text)}
                                      className="flex w-full items-center px-3 py-2 text-xs font-semibold rounded-xl hover:bg-cyan-500/10 hover:text-cyan-400 transition text-left"
                                    >
                                      Copy Text
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handlePinMessage(message.id)}
                                    className="flex w-full items-center px-3 py-2 text-xs font-semibold rounded-xl hover:bg-cyan-500/10 hover:text-cyan-400 transition text-left"
                                  >
                                    {message.isPinned ? 'Unpin Message' : 'Pin Message'}
                                  </button>
                                  <div className="my-1 border-t border-white/5" />
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMessage(message.id, 'me')}
                                    className="flex w-full items-center px-3 py-2 text-xs font-semibold rounded-xl hover:bg-rose-500/10 hover:text-rose-400 transition text-left"
                                  >
                                    Delete for me
                                  </button>
                                  {isMine && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteMessage(message.id, 'both')}
                                      className="flex w-full items-center px-3 py-2 text-xs font-semibold rounded-xl hover:bg-rose-500/10 hover:text-rose-400 transition text-left"
                                    >
                                      Delete for everyone
                                    </button>
                                  )}
                                </div>
                              )}

                            </div>

                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Typing Indicator Bubble at bottom */}
                  {typingUserId && activeTypingUser && (
                    <div className="flex justify-start items-start gap-2 animate-fade-in">
                      {activeConversation.isGroup && (
                        <div className="h-8 w-8 rounded-full overflow-hidden border border-white/10 shadow-sm mt-1">
                          {activeTypingUser.avatarUrl ? (
                            <img src={activeTypingUser.avatarUrl} alt={activeTypingUser.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-slate-800 text-xs font-bold text-slate-300">
                              {activeTypingUser.name.slice(0,1).toUpperCase()}
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className={`rounded-3xl rounded-tl-none px-4 py-3.5 flex items-center gap-1.5 w-16 border shadow-lg ${
                        darkTheme ? 'bg-slate-900/80 border-white/5 text-cyan-400' : 'bg-white border-slate-200/80 text-cyan-500'
                      }`}>
                        <span className="h-2 w-2 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
                        <span className="h-2 w-2 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
                        <span className="h-2 w-2 rounded-full bg-current animate-bounce" />
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply Indicator Draft panel */}
                {replyingToMessage && (
                  <div className={`px-5 py-3 flex items-center justify-between border-t transition animate-slide-up ${
                    darkTheme ? 'bg-slate-900/60 border-white/5' : 'bg-slate-50 border-slate-200/80'
                  }`}>
                    <div className="border-l-4 border-cyan-400 pl-3 min-w-0">
                      <p className="text-xs font-bold text-cyan-400 uppercase tracking-widest">
                        Replying to {replyingToMessage.senderId === user?.id ? 'Yourself' : (activeConversation.participants.find((p) => p.id === replyingToMessage.senderId)?.name || 'User')}
                      </p>
                      <p className={`text-xs truncate mt-0.5 ${darkTheme ? 'text-slate-300' : 'text-slate-600'}`}>
                        {replyingToMessage.fileUrl ? '📎 Attachment' : replyingToMessage.text}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyingToMessage(null)}
                      className="rounded-full bg-black/10 hover:bg-black/20 p-1.5 text-slate-400 hover:text-white transition"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* Input Bar */}
                <form onSubmit={handleSendMessage} className={`px-5 py-4 shrink-0 transition-colors ${chatFooterClass}`}>
                  <div className={`flex items-center gap-3 rounded-2xl border px-3 py-2 transition-all duration-300 ${inputAreaClass}`}>
                    
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={handleAttachClick}
                      disabled={isUploading}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900/10 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition duration-300 disabled:opacity-50"
                      title="Attach Photo or Document"
                    >
                      {isUploading ? (
                        <svg className="h-5 w-5 animate-spin text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3m0 0l3 3m-3-3v12" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                      )}
                    </button>

                    <input
                      value={draft}
                      onChange={(event) => handleTyping(event.target.value)}
                      disabled={isUploading}
                      className="flex-1 bg-transparent text-sm outline-none px-2 py-1.5 disabled:opacity-50"
                      placeholder={isUploading ? 'Uploading file attachment…' : `Message ${activeConversation.isGroup ? activeConversation.name : recipient?.name}`}
                    />
                    
                    <button
                      type="submit"
                      disabled={isUploading || !draft.trim()}
                      className="rounded-xl bg-cyan-500 px-4 py-2 text-xs font-bold text-white uppercase tracking-wider transition hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20"
                    >
                      Send
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-6 text-center">
                <div className="max-w-md">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 mx-auto mb-4 shadow-lg shadow-cyan-950/10 animate-bounce">
                    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold">Start Conversations</h3>
                  <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                    Select a conversation thread on the left, or search for members. You can pin chats for easy access, share attachments, and quote-reply to messages.
                  </p>
                </div>
              </div>
            )}
          </main>
        </div>

      </div> {/* Close max-w-7xl */}

      {/* Group Modal */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-fade-in">
          <div className={`w-full max-w-md rounded-3xl p-6 border shadow-2xl animate-slide-up ${
            darkTheme ? 'bg-slate-900 border-white/10 shadow-cyan-950/20 text-slate-100' : 'bg-white border-slate-200 shadow-slate-300/40 text-slate-900'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Create Group Conversation</h3>
              <button
                type="button"
                onClick={() => {
                  setIsGroupModalOpen(false);
                  setGroupName('');
                  setSelectedGroupContacts([]);
                  setErrorMessage('');
                }}
                className="rounded-full bg-black/10 p-1.5 text-slate-400 hover:text-white transition"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-semibold">
                  ⚠️ {errorMessage}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Group Name</label>
                <input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition focus:border-cyan-500 ${
                    darkTheme ? 'border-white/5 bg-slate-950/60 text-white' : 'border-slate-200 bg-slate-50 text-slate-900'
                  }`}
                  placeholder="Project Alpha, Family group, etc."
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Select Members</label>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {contacts.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No contacts available to add.</p>
                  ) : (
                    contacts.map((contact) => {
                      const isChecked = selectedGroupContacts.includes(contact.id);
                      return (
                        <label
                          key={contact.id}
                          className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition ${
                            isChecked
                              ? darkTheme
                                ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200 shadow-md shadow-cyan-950/10'
                                : 'border-cyan-500/40 bg-cyan-50 text-cyan-800 shadow-md shadow-cyan-100/30'
                              : darkTheme
                                ? 'border-white/5 bg-slate-950/40 text-slate-400 hover:bg-slate-800/40'
                                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setSelectedGroupContacts(selectedGroupContacts.filter((id) => id !== contact.id));
                              } else {
                                setSelectedGroupContacts([...selectedGroupContacts, contact.id]);
                              }
                            }}
                            className="rounded border-white/10 bg-slate-800 text-cyan-500 focus:ring-0 focus:ring-offset-0 h-4.5 w-4.5"
                          />
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400 font-semibold text-xs">
                            {contact.name.slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-bold">{contact.name}</p>
                            <p className="truncate text-[10px] text-slate-400">{contact.email}</p>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={!groupName.trim() || selectedGroupContacts.length === 0}
                className="w-full rounded-2xl bg-cyan-500 py-3 text-sm font-bold text-white uppercase tracking-wider transition hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/25"
              >
                Create Group
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Chat Confirmation Modal */}
      {conversationToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-fade-in">
          <div className={`w-full max-w-sm rounded-3xl p-6 border shadow-2xl animate-slide-up ${
            darkTheme ? 'bg-slate-900 border-white/10 shadow-rose-950/20 text-slate-100' : 'bg-white border-slate-200 shadow-slate-300/40 text-slate-900'
          }`}>
            <div className="flex items-center gap-3 text-rose-500 mb-4">
              <div className="p-2 bg-rose-500/10 rounded-full">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-lg font-bold">Delete Chat</h3>
            </div>
            
            <p className="text-sm text-slate-400 mb-6">
              Are you sure you want to delete this chat with <span className="font-semibold text-slate-200">{
                conversationToDelete.isGroup 
                  ? conversationToDelete.name 
                  : (conversationToDelete.participants.find(p => p.id !== user?.id)?.name || 'Private Chat')
              }</span>? This action is permanent and will delete all messages for all participants.
            </p>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setConversationToDelete(null)}
                className={`px-4 py-2 text-xs font-semibold rounded-full border transition duration-300 ${
                  darkTheme ? 'border-white/10 bg-slate-800 text-slate-300 hover:bg-slate-700' : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteConversation(conversationToDelete.id)}
                className="px-4 py-2 text-xs font-semibold rounded-full bg-rose-600 hover:bg-rose-500 text-white transition duration-300"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Lightbox */}
      {lightboxImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4 animate-fade-in cursor-zoom-out"
          onClick={() => setLightboxImageUrl(null)}
        >
          <button
            type="button"
            className="absolute top-6 right-6 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition duration-200"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={lightboxImageUrl}
            alt="Preview"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Group Settings Modal (Solid backdrop) */}
      {isGroupSettingsOpen && activeConversation && activeConversation.isGroup && activeConversation.createdBy === user?.id && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in ${
          darkTheme ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
        }`}>
          <div className={`w-full max-w-md rounded-3xl p-6 border shadow-2xl animate-slide-up flex flex-col max-h-[90vh] ${
            darkTheme ? 'bg-slate-900 border-white/10 shadow-cyan-950/20' : 'bg-white border-slate-200 shadow-slate-300/40'
          }`}>
            
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10 shrink-0">
              <h3 className="text-lg font-bold">Group Settings</h3>
              <button
                type="button"
                onClick={() => {
                  setIsGroupSettingsOpen(false);
                  setErrorMessage('');
                }}
                className="rounded-full bg-black/10 p-1.5 text-slate-400 hover:text-white transition"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {errorMessage && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-semibold shrink-0">
                ⚠️ {errorMessage}
              </div>
            )}

            {/* Scrollable Modal Content */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-1">
              
              {/* Rename Section */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rename Group</label>
                <div className="flex gap-2">
                  <input
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className={`flex-1 rounded-2xl border px-4 py-2.5 text-sm outline-none transition focus:border-cyan-500 ${
                      darkTheme ? 'border-white/5 bg-slate-950/60 text-white' : 'border-slate-200 bg-slate-50 text-slate-900'
                    }`}
                    placeholder="Enter group name"
                  />
                  <button
                    type="button"
                    onClick={handleRenameGroup}
                    className="px-5 py-2.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-white text-xs font-bold transition shadow-lg shadow-cyan-500/25 shrink-0"
                  >
                    Rename
                  </button>
                </div>
              </div>

              {/* Members List */}
              <div className="space-y-4">
                
                {/* Current Members Section */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Current Members ({activeConversation.participants.length})
                  </label>
                  <div className="space-y-2">
                    {activeConversation.participants.map((member) => {
                      const isMemberAdmin = member.id === activeConversation.createdBy;
                      return (
                        <div
                          key={member.id}
                          className={`flex items-center justify-between p-2.5 rounded-2xl border ${
                            darkTheme ? 'border-white/5 bg-slate-950/20' : 'border-slate-100 bg-slate-50'
                          }`}
                        >
                          <div className="min-w-0 flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400 font-semibold text-xs shrink-0">
                              {member.name.slice(0, 1).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold">{member.name}</p>
                              {isMemberAdmin && <span className="text-[9px] font-semibold text-cyan-400 uppercase tracking-wider">Admin</span>}
                            </div>
                          </div>

                          {!isMemberAdmin && (
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(member.id)}
                              className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold transition shadow-md shadow-rose-600/10"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Add New Members Section */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Add New Members
                  </label>
                  <div className="space-y-2">
                    {contacts.filter(c => !groupMemberIds.includes(c.id)).length === 0 ? (
                      <p className="text-[10px] text-slate-500 italic">All contacts are already in this group.</p>
                    ) : (
                      contacts.filter(c => !groupMemberIds.includes(c.id)).map((contact) => (
                        <div
                          key={contact.id}
                          className={`flex items-center justify-between p-2.5 rounded-2xl border ${
                            darkTheme ? 'border-white/5 bg-slate-950/20' : 'border-slate-100 bg-slate-50'
                          }`}
                        >
                          <div className="min-w-0 flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-500/10 text-slate-400 font-semibold text-xs shrink-0">
                              {contact.name.slice(0, 1).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold">{contact.name}</p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleAddMember(contact.id)}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold transition shadow-md shadow-emerald-600/10"
                          >
                            Add
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
