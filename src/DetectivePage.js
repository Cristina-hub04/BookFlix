import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { useBookWorld } from "./useBookWorld";
import { isMystery } from "./vibes";
import { useShop } from "./ShopContext";
import { ChapterProgress, WorldStatus } from "./WorldShared";
import { fetchCase, revealCase } from "./aiApi";


const EMPTY_BOARD = { positions: {}, links: [], notes: [], accused: "", theory: "", verdict: null };
const clamp = (n) => Math.min(95, Math.max(5, n));

// Where a card sits until the reader moves it: suspects along the top, clues in two rows below.
const defaultSpot = (kind, index, count) => {
  const spread = (i, n) => (n <= 1 ? 50 : 13 + (i * 74) / (n - 1));
  if (kind === "s") return { x: spread(index, count), y: 15 };
  const perRow = Math.ceil(count / 2);
  return { x: spread(index % perRow, perRow), y: index < perRow ? 50 : 80 };
};

// The reader's board (card positions, strings, notes, theory) is kept per account in this browser.
function useBoard(key) {
  const [board, setBoard] = useState(EMPTY_BOARD);
  const [loadedKey, setLoadedKey] = useState(null);

  useEffect(() => {
    try {
      setBoard({ ...EMPTY_BOARD, ...JSON.parse(localStorage.getItem(key) || "{}") });
    } catch {
      setBoard(EMPTY_BOARD);
    }
    setLoadedKey(key);
  }, [key]);

  useEffect(() => {
    if (loadedKey !== key) return;
    try {
      localStorage.setItem(key, JSON.stringify(board));
    } catch {
      // storage blocked: the board still works for this visit
    }
  }, [board, key, loadedKey]);

  return [board, setBoard];
}

function ScoreRing({ score }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <svg className="score-ring" viewBox="0 0 100 100" role="img" aria-label={`${score} out of 100`}>
      <circle cx="50" cy="50" r={r} className="score-ring-track" />
      <circle
        cx="50"
        cy="50"
        r={r}
        className="score-ring-value"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - score / 100)}
      />
      <text x="50" y="50" dominantBaseline="central" textAnchor="middle">{score}</text>
    </svg>
  );
}

function DetectivePage() {
  const { id } = useParams();
  const { user } = useShop();
  const { item, world, chapter, setChapter, saveProgress, status, error } = useBookWorld(id, isMystery);
  const [caseFile, setCaseFile] = useState(null);
  const [caseError, setCaseError] = useState("");
  const [board, setBoard] = useBoard(`bookflix-case:${user?.uid || "guest"}:${id}`);
  const [connecting, setConnecting] = useState(false);
  const [linkFrom, setLinkFrom] = useState(null);
  const [revealing, setRevealing] = useState(false);
  const [revealError, setRevealError] = useState("");
  const boardRef = useRef(null);
  const drag = useRef(null);

  // The case file is generated once per book and saved with it, like the world map.
  useEffect(() => {
    if (status !== "ready" || !item) return;
    if (item.caseFile) {
      setCaseFile(item.caseFile);
      return;
    }
    let cancelled = false;
    fetchCase(item, world.chapters)
      .then((file) => {
        if (cancelled) return;
        setCaseFile(file);
        updateDoc(doc(db, "item", id), { caseFile: file }).catch((err) =>
          console.error("Could not save the case file:", err)
        );
      })
      .catch((err) => !cancelled && setCaseError(err.message));
    return () => {
      cancelled = true;
    };
  }, [status, item, world, id]);

  if (status === "unavailable") {
    return (
      <div className="page">
        <div className="page-inner">
          <div className="panel empty-state">
            <div className="empty-icon">🕵</div>
            <h2>Plot Detective is for mysteries</h2>
            <p>This board opens for thrillers and crime novels. Pick one to start investigating.</p>
            <Link to="/vibes" className="btn">Find a mystery</Link>
          </div>
        </div>
      </div>
    );
  }

  if (status !== "ready" || !caseFile) {
    return (
      <div className="page">
        <div className="page-inner">
          {caseError ? (
            <WorldStatus status="error" error={caseError} item={item} />
          ) : status === "ready" ? (
            <div className="panel empty-state">
              <div className="empty-icon world-spinner">🔎</div>
              <h2>Opening the case file...</h2>
              <p>The first time takes about a minute while the AI gathers the suspects and clues.</p>
            </div>
          ) : (
            <WorldStatus status={status} error={error} item={item} />
          )}
        </div>
      </div>
    );
  }

  const total = world.chapters.length;
  const finished = chapter >= total;
  const visible = (e) => e.revealChapter <= chapter;

  const cards = [
    ...caseFile.suspects.map((s, i) => ({ key: `s:${s.id}`, kind: "s", data: s, spot: defaultSpot("s", i, caseFile.suspects.length) })),
    ...caseFile.clues.map((c, i) => ({ key: `c:${c.id}`, kind: "c", data: c, spot: defaultSpot("c", i, caseFile.clues.length) })),
  ]
    .filter((card) => visible(card.data))
    .concat(board.notes.map((n, i) => ({ key: `n:${n.id}`, kind: "n", data: n, spot: { x: 50 + (i % 4) * 6, y: 35 + (i % 3) * 8 } })));

  const pos = (card) => board.positions[card.key] || card.spot;
  const byKey = Object.fromEntries(cards.map((c) => [c.key, c]));
  const hiddenCount =
    caseFile.suspects.length + caseFile.clues.length -
    caseFile.suspects.filter(visible).length - caseFile.clues.filter(visible).length;
  const visibleSuspects = caseFile.suspects.filter(visible);
  const cardLabel = (card) => (card.kind === "s" ? card.data.name : card.kind === "c" ? card.data.title : `Note: ${card.data.text}`);

  const update = (patch) => setBoard((b) => ({ ...b, ...(typeof patch === "function" ? patch(b) : patch) }));

  const toggleLink = (a, b) =>
    update((prev) => {
      const exists = prev.links.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
      return {
        links: exists ? prev.links.filter(([x, y]) => !((x === a && y === b) || (x === b && y === a))) : [...prev.links, [a, b]],
      };
    });

  const onCardClick = (card) => {
    if (!connecting) return;
    if (!linkFrom) setLinkFrom(card.key);
    else if (linkFrom === card.key) setLinkFrom(null);
    else {
      toggleLink(linkFrom, card.key);
      setLinkFrom(null);
    }
  };

  const onPointerDown = (e, card) => {
    if (e.button !== 0 || e.target.closest("button, textarea")) return;
    const p = pos(card);
    drag.current = { key: card.key, startX: e.clientX, startY: e.clientY, x: p.x, y: p.y, moved: false };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // no capturable pointer (e.g. synthetic events): dragging still works while over the card
    }
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true;
    const rect = boardRef.current.getBoundingClientRect();
    const x = clamp(d.x + (dx / rect.width) * 100);
    const y = clamp(d.y + (dy / rect.height) * 100);
    update((prev) => ({ positions: { ...prev.positions, [d.key]: { x, y } } }));
  };

  const onPointerUp = (card) => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) onCardClick(card);
  };

  const addNote = () => {
    const note = { id: Date.now().toString(36), text: "" };
    update((prev) => ({ notes: [...prev.notes, note] }));
  };

  const reveal = async () => {
    if (!finished && !window.confirm("You haven't finished the book yet. Revealing the truth will spoil the ending. Continue?")) {
      return;
    }
    setRevealing(true);
    setRevealError("");
    try {
      const verdict = await revealCase({
        book: { title: item.title, author: item.author || item.director || "" },
        mystery: caseFile.mystery,
        suspects: visibleSuspects.map((s) => s.name),
        accused: caseFile.suspects.find((s) => s.id === board.accused)?.name || "",
        theory: board.theory,
        links: board.links
          .filter(([a, b]) => byKey[a] && byKey[b])
          .map(([a, b]) => `${cardLabel(byKey[a])} — ${cardLabel(byKey[b])}`),
        notes: board.notes.map((n) => n.text).filter(Boolean),
      });
      update({ verdict });
    } catch (err) {
      setRevealError(err.message);
    } finally {
      setRevealing(false);
    }
  };

  return (
    <div className="page">
      <div className="page-inner">
        <Link to={`/item/${id}`} className="back-link">← {item.title}</Link>
        <h1 className="page-title">Plot Detective</h1>
        <p className="page-subtitle"><b>The case:</b> {caseFile.mystery}</p>

        <ChapterProgress
          chapters={world.chapters}
          chapter={chapter}
          setChapter={setChapter}
          onSave={saveProgress}
          hint={
            hiddenCount > 0
              ? `${hiddenCount} more ${hiddenCount === 1 ? "suspect or clue appears" : "suspects and clues appear"} in later chapters.`
              : "Every suspect and clue is on the board."
          }
        />

        <div className="case-toolbar">
          <button
            type="button"
            className={`chip${connecting ? " active" : ""}`}
            onClick={() => {
              setConnecting((c) => !c);
              setLinkFrom(null);
            }}
          >
            🧵 {connecting ? "Connecting: click two cards" : "Connect with string"}
          </button>
          <button type="button" className="chip" onClick={addNote}>📝 Add a note</button>
          {board.links.length > 0 && (
            <button type="button" className="chip" onClick={() => update({ links: [] })}>
              Remove all strings
            </button>
          )}
          <span className="case-count">
            {visibleSuspects.length} suspects · {cards.filter((c) => c.kind === "c").length} clues
          </span>
        </div>

        <div className="case-board-scroll">
          <div className={`case-board${connecting ? " connecting" : ""}`} ref={boardRef}>
            <svg className="case-strings" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {board.links.map(([a, b]) =>
                byKey[a] && byKey[b] ? (
                  <line
                    key={`${a}|${b}`}
                    x1={pos(byKey[a]).x}
                    y1={pos(byKey[a]).y}
                    x2={pos(byKey[b]).x}
                    y2={pos(byKey[b]).y}
                    vectorEffect="non-scaling-stroke"
                  />
                ) : null
              )}
            </svg>

            {cards.length === 0 && (
              <p className="case-empty">Mark the chapters you've read above, and the suspects and clues will appear here.</p>
            )}

            {cards.map((card) => {
              const p = pos(card);
              const accused = card.kind === "s" && board.accused === card.data.id;
              return (
                <div
                  key={card.key}
                  className={`case-card ${card.kind === "s" ? "suspect" : card.kind === "c" ? "clue" : "note"}${
                    linkFrom === card.key ? " selected" : ""
                  }${accused ? " accused" : ""}`}
                  style={{ left: `${p.x}%`, top: `${p.y}%` }}
                  onPointerDown={(e) => onPointerDown(e, card)}
                  onPointerMove={onPointerMove}
                  onPointerUp={() => onPointerUp(card)}
                >
                  <span className="case-pin" aria-hidden="true" />
                  {card.kind === "s" && (
                    <>
                      <div className="case-suspect-head">
                        <span className="world-avatar">{card.data.name.charAt(0)}</span>
                        <div>
                          <b>{card.data.name}</b>
                          <small>{card.data.role}</small>
                        </div>
                      </div>
                      <p>{card.data.description}</p>
                      <button
                        type="button"
                        className="case-accuse"
                        onClick={() => update({ accused: accused ? "" : card.data.id })}
                      >
                        {accused ? "★ Prime suspect" : "Accuse"}
                      </button>
                    </>
                  )}
                  {card.kind === "c" && (
                    <>
                      <b>🔍 {card.data.title}</b>
                      <p>{card.data.text}</p>
                      <small className="case-chapter">Chapter {card.data.revealChapter}</small>
                    </>
                  )}
                  {card.kind === "n" && (
                    <>
                      <textarea
                        value={card.data.text}
                        placeholder="Your hunch..."
                        onChange={(e) =>
                          update((prev) => ({
                            notes: prev.notes.map((n) => (n.id === card.data.id ? { ...n, text: e.target.value } : n)),
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="case-note-delete"
                        aria-label="Delete note"
                        onClick={() =>
                          update((prev) => ({
                            notes: prev.notes.filter((n) => n.id !== card.data.id),
                            links: prev.links.filter(([a, b]) => a !== card.key && b !== card.key),
                          }))
                        }
                      >
                        ×
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <section className="panel case-theory">
          <h2 className="section-title">Your theory</h2>
          <div className="field">
            <label htmlFor="case-accused">Who did it?</label>
            <select
              id="case-accused"
              value={board.accused}
              onChange={(e) => update({ accused: e.target.value })}
            >
              <option value="">I'm not sure yet</option>
              {visibleSuspects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="case-theory">How and why?</label>
            <textarea
              id="case-theory"
              value={board.theory}
              onChange={(e) => update({ theory: e.target.value })}
              placeholder="Explain the motive, the method and the clues that gave it away..."
            />
          </div>

          {!finished && (
            <p className="case-warning">
              Finish the book to close the case. You can reveal the truth earlier, but it will spoil the ending.
            </p>
          )}
          {revealError && <p className="auth-error">{revealError}</p>}

          <button type="button" className="btn" onClick={reveal} disabled={revealing}>
            {revealing ? "Checking your theory..." : finished ? "Close the case: reveal the truth" : "Reveal anyway (spoilers)"}
          </button>
        </section>

        {board.verdict && (
          <section className="panel case-verdict">
            <ScoreRing score={board.verdict.score} />
            <div className="case-verdict-body">
              <h2>{board.verdict.headline}</h2>
              <p className="case-answer">{board.verdict.answer}</p>
              <p>{board.verdict.solution}</p>
              <div className="case-verdict-lists">
                {board.verdict.gotRight.length > 0 && (
                  <div>
                    <h3>What you got right</h3>
                    <ul>{board.verdict.gotRight.map((t) => <li key={t}>{t}</li>)}</ul>
                  </div>
                )}
                {board.verdict.missed.length > 0 && (
                  <div>
                    <h3>What you missed</h3>
                    <ul>{board.verdict.missed.map((t) => <li key={t}>{t}</li>)}</ul>
                  </div>
                )}
              </div>
              <button type="button" className="btn-link" onClick={() => update({ verdict: null })}>
                Hide the verdict
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default DetectivePage;
