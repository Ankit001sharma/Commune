import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { chatAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import socketService from '../../services/socket';
import {
  SendIcon, SearchIcon, MessageCircleIcon, CheckIcon,
} from '../../components/Icons';

const Chat = () => {
  const { id: activeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [typingUsers, setTypingUsers] = useState({});

  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);
  const isFirstRenderRef = useRef(true);

  const isNearBottom = (el) => {
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  };

  const scrollToBottom = (behavior = 'smooth') => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior });
  };

  const handleMessagesScroll = () => {
    const container = messagesContainerRef.current;
    shouldAutoScrollRef.current = isNearBottom(container);
  };

  // Fetch conversations list
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const { data } = await chatAPI.getConversations();
        setConversations(data.data || []);
      } catch (err) {
        console.error('Failed to fetch conversations:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchConversations();
  }, []);

  // Fetch active conversation
  useEffect(() => {
    if (!activeId) {
      setActiveConversation(null);
      setMessages([]);
      return;
    }
    const fetchConversation = async () => {
      try {
        const { data } = await chatAPI.getConversation(activeId);
        setActiveConversation(data.data);
        setMessages(data.data.messages || []);
        shouldAutoScrollRef.current = true;
        isFirstRenderRef.current = true;
        socketService.joinConversation(activeId);
        socketService.markAsRead(activeId);
      } catch (err) {
        console.error('Failed to fetch conversation:', err);
      }
    };
    fetchConversation();

    return () => {
      if (activeId) socketService.leaveConversation(activeId);
    };
  }, [activeId]);

  useEffect(() => {
    if (!messagesContainerRef.current || messages.length === 0) return;
    if (!shouldAutoScrollRef.current) return;

    const behavior = isFirstRenderRef.current ? 'auto' : 'smooth';
    requestAnimationFrame(() => {
      scrollToBottom(behavior);
      isFirstRenderRef.current = false;
    });
  }, [messages]);

  // Socket event listeners
  useEffect(() => {
    const handleNewMessage = (message) => {
      if (message.conversation === activeId) {
        setMessages((prev) => [...prev, message]);
        socketService.markAsRead(activeId);
      }
      // Update conversation list
      setConversations((prev) =>
        prev.map((conv) => {
          if (conv._id === message.conversation) {
            return { ...conv, lastMessage: message, updatedAt: new Date().toISOString() };
          }
          return conv;
        }).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      );
    };

    const handleTyping = ({ conversationId, userId }) => {
      if (userId !== user?._id) {
        setTypingUsers((prev) => ({ ...prev, [conversationId]: true }));
        setTimeout(() => {
          setTypingUsers((prev) => ({ ...prev, [conversationId]: false }));
        }, 3000);
      }
    };

    const handleStopTyping = ({ conversationId }) => {
      setTypingUsers((prev) => ({ ...prev, [conversationId]: false }));
    };

    socketService.on('new-message', handleNewMessage);
    socketService.on('typing', handleTyping);
    socketService.on('stop-typing', handleStopTyping);

    return () => {
      socketService.off('new-message', handleNewMessage);
      socketService.off('typing', handleTyping);
      socketService.off('stop-typing', handleStopTyping);
    };
  }, [activeId, user?._id]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeId) return;

    setSending(true);
    try {
      const { data } = await chatAPI.sendMessage(activeId, { content: newMessage.trim() });
      // Socket will broadcast to other participants
      socketService.sendMessage(activeId, data.data);
      shouldAutoScrollRef.current = true;
      setMessages((prev) => [...prev, data.data]);
      setNewMessage('');
      socketService.stopTyping(activeId);
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleTyping = () => {
    if (!activeId) return;
    socketService.startTyping(activeId);
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketService.stopTyping(activeId);
    }, 2000);
  };

  const getOtherParticipant = (conv) => {
    if (!conv?.participants) return null;
    return conv.participants.find((p) => (typeof p === 'string' ? p : p._id) !== user?._id);
  };

  const getInitials = (u) => {
    if (!u) return '??';
    return `${u.firstName?.[0] || ''}${u.lastName?.[0] || ''}`.toUpperCase();
  };

  const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
    if (seconds < 60) return 'Now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  const filteredConversations = conversations.filter((conv) => {
    if (!search) return true;
    const other = getOtherParticipant(conv);
    const name = `${other?.firstName || ''} ${other?.lastName || ''}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  if (loading) {
    return (
      <div className="loading-overlay">
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" />
          <p style={{ marginTop: 16, color: 'var(--cx-text-secondary)' }}>Loading conversations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-layout">
      {/* Conversations Sidebar */}
      <div className="chat-sidebar">
        <div className="chat-sidebar-header">
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Messages</h2>
        </div>

        <div style={{ padding: '0 12px 12px' }}>
          <div className="search-input-wrapper">
            <SearchIcon size={16} className="search-input-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ fontSize: '0.85rem' }}
            />
          </div>
        </div>

        <div className="chat-list">
          {filteredConversations.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--cx-text-muted)', fontSize: '0.85rem' }}>
              {search ? 'No conversations found' : 'No conversations yet'}
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const other = getOtherParticipant(conv);
              const isActive = conv._id === activeId;
              const lastMsg = conv.lastMessage;
              return (
                <div
                  key={conv._id}
                  className={`chat-item ${isActive ? 'active' : ''}`}
                  onClick={() => navigate(`/chat/${conv._id}`)}
                >
                  <div className="chat-item-avatar">{getInitials(other)}</div>
                  <div className="chat-item-info">
                    <div className="chat-item-name">
                      {other?.firstName} {other?.lastName}
                    </div>
                    <div className="chat-item-last">
                      {typingUsers[conv._id]
                        ? 'Typing...'
                        : lastMsg?.content
                          ? lastMsg.content.substring(0, 50) + (lastMsg.content.length > 50 ? '...' : '')
                          : conv.relatedListing?.title || conv.relatedService?.title || 'Start a conversation'
                      }
                    </div>
                  </div>
                  <div className="chat-item-time">
                    {timeAgo(conv.updatedAt || conv.createdAt)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="chat-main">
        {!activeId ? (
          <div className="empty-state">
            <MessageCircleIcon size={64} />
            <h3 className="empty-state-title">Select a conversation</h3>
            <p className="empty-state-text">Choose from your existing conversations or start a new one from a listing or service</p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="chat-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="chat-item-avatar">
                  {getInitials(getOtherParticipant(activeConversation))}
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {(() => {
                      const other = getOtherParticipant(activeConversation);
                      return `${other?.firstName || ''} ${other?.lastName || ''}`;
                    })()}
                  </div>
                  {typingUsers[activeId] && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--cx-primary)' }}>Typing...</div>
                  )}
                </div>
              </div>
              {activeConversation?.relatedListing && (
                <div
                  className="badge badge-info"
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/marketplace/${activeConversation.relatedListing._id}`)}
                >
                  Re: {activeConversation.relatedListing.title}
                </div>
              )}
              {activeConversation?.relatedService && (
                <div
                  className="badge badge-info"
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/services/${activeConversation.relatedService._id}`)}
                >
                  Re: {activeConversation.relatedService.title}
                </div>
              )}
            </div>

            {/* Messages */}
            <div
              className="chat-messages"
              ref={messagesContainerRef}
              onScroll={handleMessagesScroll}
            >
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--cx-text-muted)' }}>
                  <MessageCircleIcon size={40} />
                  <p>No messages yet. Say hello!</p>
                </div>
              ) : (
                messages.map((msg, i) => {
                  const isMine = (typeof msg.sender === 'string' ? msg.sender : msg.sender?._id) === user?._id;
                  return (
                    <div key={msg._id || i} className={`chat-message ${isMine ? 'sent' : 'received'}`}>
                      <p>{msg.content}</p>
                      <span className="chat-message-time">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {isMine && msg.read && <CheckIcon size={12} style={{ marginLeft: 4 }} />}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Message Input */}
            <form className="chat-input-bar" onSubmit={handleSend}>
              <input
                type="text"
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleTyping}
                maxLength={2000}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={sending || !newMessage.trim()}
                style={{ padding: '10px 16px' }}
              >
                <SendIcon size={20} />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default Chat;
