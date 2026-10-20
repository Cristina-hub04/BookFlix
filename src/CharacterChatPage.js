import React, { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useBookWorld } from "./useBookWorld";
import { ChapterProgress, WorldStatus } from "./WorldShared";
import { knownSoFar, streamChat } from "./aiApi";

const MAX_HISTORY = 30;

function CharacterChatPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const { item, world, chapter, setChapter, saveProgress, status, error } = useBookWorld(id);
  const [chats, setChats] = useState({}); // character name -> messages
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const endRef = useRef(null);

  const name = params.get("character");
  const messages = chats[name] || [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  if (status !== "ready") {
    return (
      <div className="page">
        <div className="page-inner">
          <WorldStatus status={status} error={error} item={item} />
        </div>
      </div>
    );
  }

  const met = world.characters.filter((c) => c.revealChapter <= chapter);
  const notMet = world.characters.length - met.length;
  const character = met.find((c) => c.name === name) || null;

  const send = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !character || sending) return;

    const history = [...messages, { role: "user", content: text }];
    setChats((c) => ({ ...c, [name]: [...history, { role: "assistant", content: "" }] }));
    setInput("");
    setSending(true);
    setChatError("");

    try {
      await streamChat(
        {
          book: { title: item.title, author: item.author || item.director || "" },
          character,
          reading: {
            chapter,
            totalChapters: world.chapters.length,
            chapterTitle: world.chapters[chapter - 1]?.title || "",
          },
          known: knownSoFar(world, chapter),
          messages: history.slice(-MAX_HISTORY),
        },
        (piece) =>
          setChats((c) => {
            const list = [...c[name]];
            const last = list[list.length - 1];
            list[list.length - 1] = { ...last, content: last.content + piece };
            return { ...c, [name]: list };
          })
      );
    } catch (err) {
      setChatError(err.message);
      // drop the empty reply bubble and put the message back in the box
      setChats((c) => ({ ...c, [name]: history.slice(0, -1) }));
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="page">
      <div className="page-inner">
        <Link to={`/item/${id}`} className="back-link">← {item.title}</Link>
        <h1 className="page-title">Character Chat</h1>
        <p className="page-subtitle">
          Talk with the people of <i>{item.title}</i>. They only know what you've read so far, so no spoilers.
        </p>

        <ChapterProgress
          chapters={world.chapters}
          chapter={chapter}
          setChapter={setChapter}
          onSave={saveProgress}
          hint={notMet > 0 ? `${notMet} more characters appear later in the book.` : "You've met everyone."}
        />

        <div className="chat-layout">
          <aside className="panel chat-people">
            <h3>Characters you've met</h3>
            {met.length === 0 && <p className="world-muted">Read a little further to meet someone.</p>}
            {met.map((c) => (
              <button
                key={c.name}
                type="button"
                className={`world-person${c.name === name ? " active" : ""}`}
                onClick={() => {
                  setParams({ character: c.name });
                  setChatError("");
                }}
              >
                <span className="world-avatar">{c.name.charAt(0)}</span>
                <span>
                  <b>{c.name}</b>
                  <small>{c.role}</small>
                </span>
              </button>
            ))}
            <Link to={`/world/${id}`} className="world-talk" style={{ marginTop: 12 }}>
              🗺 Open the map
            </Link>
          </aside>

          <section className="panel chat-window">
            {!character ? (
              <div className="world-side-empty">
                <div className="world-side-icon">💬</div>
                <h2>Who would you like to talk to?</h2>
                <p>
                  {name
                    ? `You haven't met ${name} yet by this chapter. Keep reading!`
                    : "Pick a character on the left to start a conversation."}
                </p>
              </div>
            ) : (
              <>
                <header className="chat-header">
                  <span className="world-avatar large">{character.name.charAt(0)}</span>
                  <div>
                    <h2>{character.name}</h2>
                    <small>{character.role}</small>
                  </div>
                </header>

                <div className="chat-messages">
                  {messages.length === 0 && (
                    <p className="chat-hint">
                      Say hello to {character.name.split(" ")[0]}. Ask about their life, their world, or what they think of
                      the others.
                    </p>
                  )}
                  {messages.map((m, i) => (
                    <div key={i} className={`chat-bubble ${m.role}`}>
                      {m.content || <span className="typing"><i /><i /><i /></span>}
                    </div>
                  ))}
                  <div ref={endRef} />
                </div>

                {chatError && <p className="chat-error">{chatError}</p>}

                <form className="chat-input" onSubmit={send}>
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={`Write to ${character.name.split(" ")[0]}...`}
                    aria-label="Message"
                    maxLength={4000}
                  />
                  <button type="submit" className="btn" disabled={sending || !input.trim()}>
                    Send
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default CharacterChatPage;
