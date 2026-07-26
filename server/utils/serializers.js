export function serializeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar || user.name?.slice(0, 1).toUpperCase() || 'U',
    avatarUrl: user.avatarUrl || null,
    isOnline: Boolean(user.isOnline),
    lastSeenAt: user.lastSeenAt || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function serializeConversation(conversation, lastMessage = null) {
  return {
    id: conversation.id,
    participants: conversation.participants,
    lastMessage,
    updatedAt: conversation.updatedAt,
    unreadCount: conversation.unreadCount || 0,
  };
}

export function serializeMessage(message) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    text: message.text,
    type: message.type,
    attachment: message.attachment || null,
    replyTo: message.replyTo || null,
    forwardedFrom: message.forwardedFrom || null,
    reactions: message.reactions || [],
    pinned: Boolean(message.pinned),
    deletedAt: message.deletedAt || null,
    deletedBy: message.deletedBy || null,
    deliveredAt: message.deliveredAt || null,
    readAt: message.readAt || null,
    editedAt: message.editedAt || null,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
}
