import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, User, Wrench, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface AIChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  tool_called?: string;
  timestamp: string;
}

export const AIChatDrawer: React.FC<AIChatDrawerProps> = ({ isOpen, onClose }) => {
  const { role } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Hello! I am your authorized HCM Lite AI Assistant. Every answer I provide comes directly from real company records and strictly adheres to your role permissions.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const samplePrompts = role === 'employee'
    ? [
        'How many sick leaves do I have left this year?',
        'What are the company office hours and grace time?',
        "What is John's salary?",
        'What is the company annual tax slab?',
      ]
    : [
        'Who is on leave today?',
        'Who came late most often this month?',
        "What is this month's attendance rate?",
        'How many active employees are there?',
      ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [isOpen, messages]);

  if (!isOpen) return null;

  const handleSend = async (textToSend?: string) => {
    const promptText = (textToSend || input).trim();
    if (!promptText || loading) return;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      sender: 'user',
      text: promptText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const res = await api.askAI(promptText);
      const assistantMsg: ChatMessage = {
        id: String(Date.now() + 1),
        sender: 'assistant',
        text: res.reply,
        tool_called: res.tool_called,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          sender: 'assistant',
          text: 'Sorry, I encountered an issue retrieving real-time data. Please ensure the server is operating normally.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="drawer-overlay">
      <div className="chat-drawer">
        <div className="chat-header">
          <div className="chat-header-title">
            <div className="ai-icon-badge">
              <Bot size={20} />
            </div>
            <div>
              <h3>HCM AI Assistant</h3>
              <span className="live-status">
                <span className="status-dot configured" /> Connected to Database
              </span>
            </div>
          </div>
          <div className="chat-header-actions">
            <button
              onClick={() =>
                setMessages([
                  {
                    id: 'welcome',
                    sender: 'assistant',
                    text: 'Chat history cleared. How can I help you today?',
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  },
                ])
              }
              className="chat-action-btn"
              title="Clear chat"
            >
              <Trash2 size={16} />
            </button>
            <button onClick={onClose} className="chat-action-btn" title="Close drawer">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="chat-messages">
          {messages.map((m) => (
            <div key={m.id} className={`message-bubble-row ${m.sender}`}>
              <div className="message-avatar">
                {m.sender === 'assistant' ? <Bot size={16} /> : <User size={16} />}
              </div>
              <div className="message-content">
                {m.tool_called && (
                  <div className="tool-executed-badge">
                    <Wrench size={11} />
                    <span>Tool executed: <code>{m.tool_called}</code></span>
                  </div>
                )}
                <div className="message-body">
                  {m.text.split('\n').map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
                <div className="message-meta">
                  {m.sender === 'assistant' && <span className="ai-badge">AI-generated</span>}
                  <span className="message-time">{m.timestamp}</span>
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="message-bubble-row assistant">
              <div className="message-avatar">
                <Bot size={16} />
              </div>
              <div className="message-content">
                <div className="typing-indicator">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-prompt-suggestions">
          <span className="suggestions-label">Try asking:</span>
          <div className="suggestions-list">
            {samplePrompts.map((p, idx) => (
              <button
                key={idx}
                className="suggestion-pill"
                onClick={() => handleSend(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="chat-input-area">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="chat-form"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask attendance, leaves, headcount, policies..."
              disabled={loading}
            />
            <button type="submit" disabled={!input.trim() || loading} className="chat-send-btn">
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
