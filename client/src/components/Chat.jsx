import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApp } from '../lib/state.jsx';
import { cleanAiText } from '../lib/format.js';
import { Icon } from './ui.jsx';

const STORAGE_KEY_ACTIVE = 'ks_chat_active';
const STORAGE_KEY_HISTORY = 'ks_chat_history';

// AI chatbot (bottom-right). Answers strictly from evidence; preserves history with archive & new chat.
export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [msgs, setMsgs] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ACTIVE);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HISTORY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const { picks, category } = useApp();
  const loc = useLocation();
  const end = useRef(null);

  const cellId = loc.pathname.startsWith('/location/') ? loc.pathname.split('/')[2] : undefined;
  const pickCells = picks.filter((p) => !p.empty).map((p) => p.cell);
  const ctxName = cellId ? 'this location' : pickCells.length ? 'your current picks' : null;

  const suggestions = cellId
    ? [
        'Why does this site rank well?',
        'What rent makes it stop making money?',
        'What breaks it in the stress tests?',
        'How much will it take from my stores?',
      ]
    : [
        'Why is the best pick ranked first?',
        'Which pick is safest if rent rises 25%?',
        'How much will the best pick take from my stores?',
      ];

  // Auto-scroll when messages update
  useEffect(() => {
    if (!showHistory) {
      end.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [msgs, busy, showHistory]);

  // Persist active messages to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE, JSON.stringify(msgs));
    } catch {}
  }, [msgs]);

  // Persist history archive to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
    } catch {}
  }, [history]);

  const saveCurrentToHistory = () => {
    if (!msgs || msgs.length === 0) return;
    const firstQ = msgs.find((m) => m.me)?.text;
    const title = firstQ ? (firstQ.length > 40 ? `${firstQ.slice(0, 40)}…` : firstQ) : (ctxName ? `Inquiry on ${ctxName}` : 'General Inquiry');
    const newSession = {
      id: Date.now().toString(),
      title,
      createdAt: new Date().toISOString(),
      ctxName: ctxName || 'Overview',
      msgs: [...msgs],
    };
    setHistory((prev) => [newSession, ...prev.slice(0, 19)]);
  };

  const startNewChat = () => {
    if (msgs.length > 0) {
      saveCurrentToHistory();
    }
    setMsgs([]);
    setShowHistory(false);
    setText('');
  };

  const restoreSession = (session) => {
    if (msgs.length > 0 && msgs !== session.msgs) {
      saveCurrentToHistory();
    }
    setMsgs(session.msgs || []);
    setShowHistory(false);
  };

  const deleteHistorySession = (e, id) => {
    e.stopPropagation();
    setHistory((prev) => prev.filter((s) => s.id !== id));
  };

  const ask = async (q) => {
    const m = (q ?? text).trim();
    if (!m || busy) return;
    setText('');
    setMsgs((x) => [...x, { me: true, text: m }]);
    setBusy(true);
    setShowHistory(false);
    try {
      const r = await api('/chat', {
        method: 'POST',
        body: { message: m, category, cellId, picks: cellId ? undefined : pickCells },
      });
      setMsgs((x) => [...x, { text: r.answer, evidence: r.evidence, source: r.narrative_source }]);
    } catch (e) {
      setMsgs((x) => [...x, { text: e.message, error: true }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {open && (
        <div className="chatbox" role="dialog" aria-label="Ask Karyakshetram">
          {/* Header */}
          <div className="row sb ac pad16" style={{ borderBottom: '1px solid var(--line)' }}>
            <span className="row g8 ac b s15">
              <Icon n="sparkling-2-fill" s={18} c="var(--accent)" />
              Ask Karyakshetram
            </span>
            <span className="row g6 ac">
              {/* History Toggle Button */}
              <button
                className={`iconbtn ${showHistory ? 'on' : ''}`}
                style={{
                  width: 32,
                  height: 32,
                  color: showHistory ? 'var(--accent2)' : 'var(--text)',
                  borderColor: showHistory ? 'var(--accent2)' : 'var(--line)',
                  background: showHistory ? 'var(--surface2)' : 'transparent',
                }}
                onClick={() => setShowHistory(!showHistory)}
                title="Preserved Chat History"
                aria-label="Preserved Chat History"
              >
                <Icon n="history-line" s={16} />
              </button>

              {/* Start New Chat Button (preserves current) */}
              <button
                className="iconbtn"
                style={{ width: 32, height: 32 }}
                onClick={startNewChat}
                title="Start new chat (preserves current in history)"
                aria-label="Start new chat"
              >
                <Icon n="add-line" s={16} />
              </button>

              {/* Close Button */}
              <button
                className="iconbtn"
                style={{ width: 32, height: 32 }}
                onClick={() => setOpen(false)}
                aria-label="Close chat"
              >
                <Icon n="close-line" s={16} />
              </button>
            </span>
          </div>

          {/* History Panel Overlay */}
          {showHistory ? (
            <div className="col g12 pad16 f1" style={{ overflowY: 'auto' }}>
              <div className="row sb ac">
                <span className="b s14 row g6 ac">
                  <Icon n="time-line" s={16} c="var(--accent)" />
                  Preserved Chat History
                </span>
                <span className="tag">{history.length} saved</span>
              </div>
              <p className="s12 muted">
                Previous AI conversations are saved here. Click any chat to resume it.
              </p>

              {msgs.length > 0 && (
                <button
                  className="btn out sm"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => setShowHistory(false)}
                >
                  <Icon n="chat-voice-line" s={14} />
                  Return to Active Conversation ({msgs.length} msgs)
                </button>
              )}

              {history.length === 0 ? (
                <div className="col g8 ac pad20 muted s13" style={{ textAlign: 'center', marginTop: 30 }}>
                  <Icon n="chat-history-line" s={32} c="var(--faint)" />
                  <span>No archived conversations yet.</span>
                  <span className="s11">When you click + to start a new chat, current conversations are saved here.</span>
                </div>
              ) : (
                <div className="col g8" style={{ marginTop: 6 }}>
                  {history.map((s) => (
                    <div
                      key={s.id}
                      className="card pad12 col g4 click panel"
                      onClick={() => restoreSession(s)}
                      style={{
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        border: '1px solid var(--line)',
                      }}
                    >
                      <div className="row sb ac">
                        <span className="b s13 truncate" style={{ maxWidth: 220 }}>
                          {s.title}
                        </span>
                        <button
                          className="iconbtn ghost"
                          style={{ width: 24, height: 24 }}
                          onClick={(e) => deleteHistorySession(e, s.id)}
                          title="Remove from history"
                          aria-label="Remove from history"
                        >
                          <Icon n="close-line" s={13} c="var(--muted)" />
                        </button>
                      </div>
                      <div className="row sb ac s11 muted">
                        <span>{new Date(s.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="tag">{s.msgs.length} messages</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Active Conversation Messages */
            <div className="col g12 pad16 f1" style={{ overflowY: 'auto' }}>
              <div className="s13 muted">
                {ctxName
                  ? `Ask about ${ctxName}. Answers strictly use numbers from your results.`
                  : 'Search a locality or open a location first, then ask about it.'}
              </div>

              {!msgs.length && ctxName && (
                <div className="col g8" style={{ alignItems: 'flex-end' }}>
                  {suggestions.map((s) => (
                    <button key={s} className="chip" onClick={() => ask(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {msgs.map((m, i) =>
                m.me ? (
                  <div key={i} className="bubble-me">
                    {m.text}
                  </div>
                ) : (
                  <div key={i} className="bubble-ai col g8" style={m.error ? { color: 'var(--bad)' } : undefined}>
                    <span style={{ lineHeight: 1.55 }}>{cleanAiText(m.text)}</span>
                  </div>
                )
              )}

              {busy && (
                <div className="bubble-ai row g6 muted">
                  <Icon n="loader-4-line" className="spin" />
                  Thinking…
                </div>
              )}
              <div ref={end} />
            </div>
          )}

          {/* Chat Input Form */}
          <form
            className="row g8 pad12"
            style={{ borderTop: '1px solid var(--line)' }}
            onSubmit={(e) => {
              e.preventDefault();
              ask();
            }}
          >
            <div className="input f1">
              <input
                placeholder={showHistory ? 'Click a chat above or type a new query…' : 'Ask a question…'}
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={500}
                aria-label="Question"
              />
            </div>
            <button
              className="iconbtn"
              style={{ background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' }}
              disabled={busy || !text.trim()}
              aria-label="Send"
            >
              <Icon n="send-plane-2-fill" s={16} />
            </button>
          </form>
        </div>
      )}

      {/* Floating Action Button */}
      <button
        className="fab"
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Close chat' : 'Open AI chat'}
      >
        <Icon n={open ? 'close-line' : 'sparkling-2-fill'} />
      </button>
    </>
  );
}

