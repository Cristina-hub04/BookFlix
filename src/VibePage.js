import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import BookCard from "./BookCard";
import { VIBE_GROUPS, scoreByVibes } from "./vibes";

const PRESETS = [
  { label: "Rainy night mystery", vibes: ["rain", "city at night", "mystery", "solitude"] },
  { label: "Blanket & tea", vibes: ["cozy", "hopeful", "family", "snow & winter"] },
  { label: "Grand adventure", vibes: ["faraway worlds", "epic", "journey", "friendship"] },
  { label: "Can't-sleep thriller", vibes: ["tense", "unsettling", "obsession", "dark"] },
];

function VibePage() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    getDocs(collection(db, "item"))
      .then((snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
      .catch((err) => console.error("Error fetching items:", err));
  }, []);

  const toggle = (vibe) =>
    setSelected((s) => (s.includes(vibe) ? s.filter((v) => v !== vibe) : [...s, vibe]));

  const results = items
    .map((item) => ({ item, ...scoreByVibes(item, selected) }))
    .filter((r) => r.matched.length > 0)
    .sort((a, b) => b.score - a.score || (b.item.vibes?.length || 0) - (a.item.vibes?.length || 0));

  return (
    <div className="page">
      <div className="page-inner">
        <h1 className="page-title">Book by Vibe</h1>
        <p className="page-subtitle">
          Don't pick a genre, pick a feeling. Choose the atmosphere you're craving and we'll find the books that carry it.
        </p>

        <div className="panel vibe-picker">
          <div className="vibe-presets">
            <span className="vibe-presets-label">Try a mood:</span>
            {PRESETS.map((p) => (
              <button key={p.label} type="button" className="chip" onClick={() => setSelected(p.vibes)}>
                {p.label}
              </button>
            ))}
          </div>

          {VIBE_GROUPS.map((group) => (
            <div key={group.name} className="vibe-group">
              <h3>{group.name}</h3>
              <div className="chips">
                {group.vibes.map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`chip vibe-chip${selected.includes(v) ? " active" : ""}`}
                    onClick={() => toggle(v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {selected.length > 0 && (
            <div className="vibe-selected">
              <span>
                Your vibe: <b>{selected.join(" · ")}</b>
              </span>
              <button type="button" className="btn-link" onClick={() => setSelected([])}>
                Clear
              </button>
            </div>
          )}
        </div>

        {selected.length === 0 ? (
          <p className="results-empty">Pick a few vibes above to see your matches.</p>
        ) : results.length === 0 ? (
          <p className="results-empty">No book carries that exact mix yet. Try removing a vibe.</p>
        ) : (
          <>
            <div className="results-head">
              <h2>{results.length} books match your vibe</h2>
            </div>
            <div className="card-grid">
              {results.map(({ item, matched, score }) => (
                <div key={item.id} className="vibe-result">
                  <span className="vibe-score">{Math.round(score * 100)}% match</span>
                  <BookCard item={item} />
                  <div className="vibe-matched">
                    {matched.map((v) => (
                      <span key={v}>{v}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default VibePage;
