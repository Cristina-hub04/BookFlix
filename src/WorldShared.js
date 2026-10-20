import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

// Title of a chapter for the picker. Titles of chapters the reader hasn't
// reached yet stay hidden, since a title alone can give the story away.
export const chapterLabel = (c, lastRead) =>
  c.title && c.number <= lastRead + 1 ? `Chapter ${c.number}: ${c.title}` : `Chapter ${c.number}`;

// "Where are you in the book?" chapter picker shared by the book page, the map and the chat.
// Every change is saved right away.
export function ChapterProgress({ chapters, chapter, setChapter, onSave, hint }) {
  const [saved, setSaved] = useState(false);
  const timer = useRef(null);
  const total = chapters.length;

  useEffect(() => () => clearTimeout(timer.current), []);

  const change = async (next) => {
    const value = Math.min(total, Math.max(0, next));
    setChapter(value);
    try {
      await onSave(value);
      setSaved(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setSaved(false), 1600);
    } catch (err) {
      console.error("Could not save progress:", err);
    }
  };

  return (
    <div className="panel reading-progress">
      <div className="reading-progress-head">
        <label htmlFor="chapter-picker">Where are you in the book?</label>
        <b>{saved ? "Saved ✓" : chapter === 0 ? "Not started" : `${chapter} of ${total} chapters`}</b>
      </div>

      <div className="chapter-picker">
        <button
          type="button"
          className="chapter-step"
          onClick={() => change(chapter - 1)}
          disabled={chapter === 0}
          aria-label="Previous chapter"
        >
          ‹
        </button>
        <select id="chapter-picker" value={chapter} onChange={(e) => change(Number(e.target.value))}>
          <option value={0}>I haven't started yet</option>
          {chapters.map((c) => (
            <option key={c.number} value={c.number}>
              I've finished {chapterLabel(c, chapter)}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="chapter-step"
          onClick={() => change(chapter + 1)}
          disabled={chapter === total}
          aria-label="Next chapter"
        >
          ›
        </button>
      </div>

      <div className="chapter-track" aria-hidden="true">
        {chapters.map((c) => (
          <span key={c.number} className={c.number <= chapter ? "done" : ""} />
        ))}
      </div>

      {hint && <div className="reading-progress-foot">{hint}</div>}
    </div>
  );
}

export function WorldStatus({ status, error, item }) {
  if (status === "error") {
    return (
      <div className="panel empty-state">
        <div className="empty-icon">🕯</div>
        <h2>The story world is closed for now</h2>
        <p>{error}</p>
        {item && <Link to={`/item/${item.id}`} className="btn">Back to the book</Link>}
      </div>
    );
  }
  return (
    <div className="panel empty-state">
      <div className="empty-icon world-spinner">🧭</div>
      <h2>{status === "building" ? "Drawing the map of this world..." : "Opening the book..."}</h2>
      <p>
        {status === "building"
          ? "The first visit to a book takes about a minute while the AI charts its chapters, places, people and moments."
          : "Just a moment."}
      </p>
    </div>
  );
}
