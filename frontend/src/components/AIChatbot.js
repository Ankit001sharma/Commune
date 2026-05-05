import React, { useState, useRef, useEffect } from 'react';
import { aiAPI } from '../services/api';
import { BotIcon, SendIcon, XIcon } from './Icons';

const AIChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'bot',
      content: 'Hello! I\'m the CommuneX assistant. I can help you navigate the platform, find items, services, and answer your questions. How can I help you today?',
      time: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', content: input.trim(), time: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const { data } = await aiAPI.chatbot(userMessage.content);
      const botMessage = {
        role: 'bot',
        content: data.data?.message || data.data?.response || 'I\'m not sure how to help with that. Try asking about marketplace items, services, or how to use the platform.',
        time: new Date(),
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'bot',
          content: 'Sorry, I encountered an error. Please try again.',
          time: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    'How do I post an item?',
    'How does escrow work?',
    'Find tutoring services',
    'How to start a chat?',
  ];

  const handleQuickAction = (action) => {
    setInput(action);
  };

  return (
    <>
      {/* Chatbot Toggle Button */}
      <button
        className="chatbot-toggle"
        onClick={() => setIsOpen(!isOpen)}
        title="AI Assistant"
      >
        {isOpen ? <XIcon size={24} /> : <BotIcon size={24} />}
      </button>

      {/* Chatbot Window */}
      {isOpen && (
        <div className="chatbot-window">
          <div className="chatbot-header">
            <div className="chatbot-header-icon">
              <BotIcon size={20} />
            </div>
            <div>
              <div className="chatbot-header-title">CommuneX Assistant</div>
              <div className="chatbot-header-sub">AI-powered help</div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{ marginLeft: 'auto', color: '#fff', opacity: 0.8 }}
              title="Close"
            >
              <XIcon size={18} />
            </button>
          </div>

          <div className="chatbot-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`chatbot-msg ${msg.role}`}>
                {msg.content}
              </div>
            ))}
            {loading && (
              <div className="chatbot-msg bot" style={{ opacity: 0.6 }}>
                Thinking...
              </div>
            )}
            <div ref={messagesEndRef} />

            {/* Quick Actions */}
            {messages.length <= 1 && (
              <div className="chatbot-suggestions">
                {quickActions.map((action, i) => (
                  <button
                    key={i}
                    className="chatbot-suggestion"
                    onClick={() => handleQuickAction(action)}
                  >
                    {action}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form className="chatbot-input-bar" onSubmit={handleSend}>
            <input
              type="text"
              placeholder="Ask me anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={500}
            />
            <button type="submit" className="chatbot-send" disabled={loading || !input.trim()}>
              <SendIcon size={18} />
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default AIChatbot;
