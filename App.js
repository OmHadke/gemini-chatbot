import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function formatTime(date) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`message-row ${isUser ? 'user-row' : 'bot-row'}`}>
      {!isUser && (
        <div className="avatar bot-avatar">
          <GeminiIcon />
        </div>
      )}
      <div className={`bubble ${isUser ? 'user-bubble' : 'bot-bubble'}`}>
        <p className="bubble-text">{message.content}</p>
        <span className="bubble-time">{formatTime(message.timestamp)}</span>
      </div>
      {isUser && <div className="avatar user-avatar">You</div>}
    </div>
  );
}

function GeminiIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z" fill="currentColor"/>
    </svg>
  );
}

function ChatSidebar({ chats, activeChatId, onSelectChat, onNewChat }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <GeminiIcon />
          <span>Gemini Chat</span>
        </div>
        <button className="new-chat-btn" onClick={onNewChat}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Chat
        </button>
      </div>
      <div className="chat-list">
        {chats.length === 0 && (
          <div className="no-chats">No conversations yet</div>
        )}
        {chats.map((chat) => (
          <button
            key={chat.id}
            className={`chat-item ${chat.id === activeChatId ? 'active' : ''}`}
            onClick={() => onSelectChat(chat.id)}
          >
            <div className="chat-item-icon">
              {chat.hasImage ? '🖼' : chat.hasDocument ? '📄' : '💬'}
            </div>
            <div className="chat-item-info">
              <span className="chat-preview">{chat.preview || 'New Chat'}</span>
              <span className="chat-meta">{chat.messageCount} messages</span>
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}

export default function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [hasDocument, setHasDocument] = useState(false);
  const [hasImage, setHasImage] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [docName, setDocName] = useState(null);
  const [error, setError] = useState(null);

  const messagesEndRef = useRef(null);
  const docInputRef = useRef(null);
  const imgInputRef = useRef(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => { scrollToBottom(); }, [messages, loading]);

  const fetchChats = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/chats`);
      setChats(res.data);
    } catch {}
  }, []);

  useEffect(() => { fetchChats(); }, [fetchChats]);

  const createNewChat = useCallback(async () => {
    try {
      const res = await axios.post(`${API_BASE}/api/chat/new`);
      const newId = res.data.chatId;
      setActiveChatId(newId);
      setMessages([]);
      setHasDocument(false);
      setHasImage(false);
      setImagePreview(null);
      setDocName(null);
      setError(null);
      await fetchChats();
    } catch (e) {
      setError('Failed to create new chat.');
    }
  }, [fetchChats]);

  useEffect(() => {
    if (!activeChatId) createNewChat();
  }, []);  // eslint-disable-line

  const selectChat = useCallback(async (chatId) => {
    setActiveChatId(chatId);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE}/api/chat/${chatId}`);
      const data = res.data;
      setMessages(
        data.messages.map((m, i) => ({ ...m, timestamp: Date.now() - (data.messages.length - i) * 1000 }))
      );
      setHasDocument(data.hasDocument);
      setHasImage(data.hasImage);
      if (!data.hasImage) setImagePreview(null);
    } catch {
      setError('Failed to load chat.');
    }
  }, []);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    if (!apiKey) { setShowApiKeyModal(true); return; }

    const userMessage = { role: 'user', content: input.trim(), timestamp: Date.now() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const res = await axios.post(`${API_BASE}/api/chat/${activeChatId}/message`, {
        message: input.trim(),
        apiKey,
      });
      const botMessage = { role: 'assistant', content: res.data.response, timestamp: Date.now() };
      setMessages((prev) => [...prev, botMessage]);
      await fetchChats();
    } catch (e) {
      const errMsg = e.response?.data?.error || 'Something went wrong. Check your API key.';
      setError(errMsg);
      setMessages((prev) => prev.slice(0, -1));
      setInput(userMessage.content);
    } finally {
      setLoading(false);
    }
  };

  const handleDocUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingDoc(true);
    setError(null);
    const form = new FormData();
    form.append('file', file);
    try {
      await axios.post(`${API_BASE}/api/chat/${activeChatId}/upload/document`, form);
      setHasDocument(true);
      setDocName(file.name);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload document.');
    } finally {
      setUploadingDoc(false);
      e.target.value = '';
    }
  };

  const handleImgUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingImg(true);
    setError(null);
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await axios.post(`${API_BASE}/api/chat/${activeChatId}/upload/image`, form);
      setHasImage(true);
      setImagePreview(res.data.previewUrl);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload image.');
    } finally {
      setUploadingImg(false);
      e.target.value = '';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const saveApiKey = () => {
    const key = apiKeyInput.trim();
    if (!key) return;
    setApiKey(key);
    localStorage.setItem('gemini_api_key', key);
    setApiKeyInput('');
    setShowApiKeyModal(false);
  };

  return (
    <div className="app">
      {/* API Key Modal */}
      {showApiKeyModal && (
        <div className="modal-overlay" onClick={() => setShowApiKeyModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Enter Gemini API Key</h2>
            <p>Your key is stored locally and never sent to our servers.</p>
            <input
              type="password"
              className="modal-input"
              placeholder="AIza..."
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveApiKey()}
              autoFocus
            />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowApiKeyModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={saveApiKey}>Save Key</button>
            </div>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="api-link"
            >
              Get a free API key →
            </a>
          </div>
        </div>
      )}

      <ChatSidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={selectChat}
        onNewChat={createNewChat}
      />

      <main className="chat-main">
        {/* Header */}
        <header className="chat-header">
          <div className="header-left">
            <h1 className="chat-title">
              {activeChatId ? 'Conversation' : 'Gemini Chat'}
            </h1>
            <div className="context-badges">
              {hasDocument && (
                <span className="badge doc-badge">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/></svg>
                  {docName || 'Document'}
                </span>
              )}
              {hasImage && (
                <span className="badge img-badge">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  Image
                </span>
              )}
            </div>
          </div>
          <div className="header-actions">
            <button
              className="api-key-btn"
              onClick={() => setShowApiKeyModal(true)}
              title={apiKey ? 'Change API Key' : 'Set API Key'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
              </svg>
              {apiKey ? 'API Key ✓' : 'Set API Key'}
            </button>
          </div>
        </header>

        {/* Messages */}
        <div className="messages-area">
          {messages.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon"><GeminiIcon /></div>
              <h2>Start a conversation</h2>
              <p>Upload a document or image, then ask anything.</p>
              <div className="empty-hints">
                <div className="hint">"Summarize the document"</div>
                <div className="hint">"What's in the image?"</div>
                <div className="hint">"Explain this concept"</div>
              </div>
            </div>
          )}

          {imagePreview && (
            <div className="image-preview-bar">
              <img src={imagePreview} alt="Uploaded" className="image-preview" />
              <span className="image-preview-label">Image context active</span>
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}

          {loading && (
            <div className="message-row bot-row">
              <div className="avatar bot-avatar"><GeminiIcon /></div>
              <div className="bubble bot-bubble typing-bubble">
                <div className="typing-dots">
                  <span /><span /><span />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="error-bar">{error}</div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="input-area">
          <div className="upload-buttons">
            <input ref={docInputRef} type="file" accept=".pdf,.txt" onChange={handleDocUpload} style={{ display: 'none' }} />
            <input ref={imgInputRef} type="file" accept=".png,.jpg,.jpeg" onChange={handleImgUpload} style={{ display: 'none' }} />

            <button
              className={`upload-btn ${uploadingDoc ? 'uploading' : ''} ${hasDocument ? 'has-file' : ''}`}
              onClick={() => docInputRef.current?.click()}
              disabled={uploadingDoc || uploadingImg}
              title="Upload PDF or TXT"
            >
              {uploadingDoc ? (
                <svg className="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              )}
              {uploadingDoc ? 'Uploading...' : hasDocument ? 'Doc ✓' : 'Upload Doc'}
            </button>

            <button
              className={`upload-btn ${uploadingImg ? 'uploading' : ''} ${hasImage ? 'has-file' : ''}`}
              onClick={() => imgInputRef.current?.click()}
              disabled={uploadingDoc || uploadingImg}
              title="Upload PNG or JPG"
            >
              {uploadingImg ? (
                <svg className="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              )}
              {uploadingImg ? 'Uploading...' : hasImage ? 'Image ✓' : 'Upload Image'}
            </button>
          </div>

          <div className="input-row">
            <textarea
              className="message-input"
              placeholder={apiKey ? "Type a message… (Enter to send)" : "Set your API key to start chatting"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={loading || !activeChatId}
            />
            <button
              className="send-btn"
              onClick={handleSend}
              disabled={loading || !input.trim() || !activeChatId}
            >
              {loading ? (
                <svg className="spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
