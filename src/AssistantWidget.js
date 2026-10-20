import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { useShop, getPrice, formatPrice } from "./ShopContext";
import { streamAssistant } from "./aiApi";

const MAX_HISTORY = 20;

const SUGGESTIONS = [
  "Recommend a cozy book for a rainy evening",
  "How does Enter the Book work?",
  "What's in my cart?",
];

// Renders the assistant's text: paragraphs, **bold** and links to pages of the site.
function RichText({ text }) {
  return text.split(/\n{2,}/).map((para, i) => (
    <p key={i}>
      {para.split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*)/g).map((part, j) => {
        const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (link) {
          return link[2].startsWith("/") ? (
            <Link key={j} to={link[2]}>{link[1]}</Link>
          ) : (
            <span key={j}>{link[1]}</span>
          );
        }
        const bold = part.match(/^\*\*([^*]+)\*\*$/);
        if (bold) return <b key={j}>{bold[1]}</b>;
        return part.split("\n").map((line, k, all) => (
          <React.Fragment key={`${j}-${k}`}>
            {line}
            {k < all.length - 1 && <br />}
          </React.Fragment>
        ));
      })}
    </p>
  ));
}

function AssistantWidget() {
  const { pathname } = useLocation();
  const { cart, favorites, user } = useShop();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const catalog = useRef(null);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const loadCatalog = async () => {
    if (catalog.current) return catalog.current;
    const snap = await getDocs(collection(db, "item"));
    catalog.current = snap.docs.map((d) => {
      const b = { id: d.id, ...d.data() };
      return {
        id: b.id,
        title: b.title || "",
        author: b.author || b.director || "",
        year: b.year,
        vibes: b.vibes || [],
        price: formatPrice(getPrice(b)),
      };
    });
    return catalog.current;
  };

  const send = async (text) => {
    text = text.trim();
    if (!text || sending) return;

    const history = [...messages, { role: "user", content: text }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setSending(true);
    setError("");

    try {
      await streamAssistant(
        {
          page: { path: pathname, title: document.querySelector("h1")?.innerText || "" },
          catalog: await loadCatalog(),
          cart: cart.map((l) => `${l.title} (${l.kind === "buy" ? "purchase" : "read online"})`),
          favorites: favorites.map((f) => f.title),
          signedIn: Boolean(user),
          messages: history.slice(-MAX_HISTORY),
        },
        (piece) =>
          setMessages((list) => {
            const next = [...list];
            const last = next[next.length - 1];
            next[next.length - 1] = { ...last, content: last.content + piece };
            return next;
          })
      );
    } catch (err) {
      setError(err.message);
      setMessages(history.slice(0, -1));
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={`assistant${open ? " open" : ""}`}>
      {open && (
        <section className="assistant-panel" role="dialog" aria-label="BookFlix assistant">
          <header className="assistant-header">
            <span className="assistant-avatar" aria-hidden="true">✦</span>
            <div>
              <b>BookFlix Assistant</b>
              <small>Here to help you find your next story</small>
            </div>
            {messages.length > 0 && (
              <button
                type="button"
                className="assistant-icon-btn"
                onClick={() => {
                  setMessages([]);
                  setError("");
                }}
                title="Start over"
                aria-label="Start a new conversation"
              >
                ↺
              </button>
            )}
            <button
              type="button"
              className="assistant-icon-btn"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
            >
              ×
            </button>
          </header>

          <div className="assistant-messages">
            {messages.length === 0 && (
              <div className="assistant-welcome">
                <p>Hi! I can recommend books, explain how BookFlix works, or help you find your way around.</p>
                <div className="assistant-suggestions">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" onClick={() => send(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`assistant-bubble ${m.role}`}>
                {m.content ? (
                  m.role === "assistant" ? <RichText text={m.content} /> : m.content
                ) : (
                  <span className="typing"><i /><i /><i /></span>
                )}
              </div>
            ))}
            {error && <p className="assistant-error">{error}</p>}
            <div ref={endRef} />
          </div>

          <form
            className="assistant-input"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything..."
              aria-label="Message the assistant"
              maxLength={4000}
            />
            <button type="submit" className="btn" disabled={sending || !input.trim()} aria-label="Send">
              ➤
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        className="assistant-launcher"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close assistant" : "Open the BookFlix assistant"}
        aria-expanded={open}
      >
        {open ? "×" : "✦"}
      </button>
    </div>
  );
}

export default AssistantWidget;
