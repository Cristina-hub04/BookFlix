import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useBookWorld } from "./useBookWorld";
import { ChapterProgress, WorldStatus } from "./WorldShared";

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, Number(n) || 0));

function WorldMapPage() {
  const { id } = useParams();
  const { item, world, chapter, setChapter, saveProgress, status, error } = useBookWorld(id);
  const [selectedId, setSelectedId] = useState(null);

  if (status !== "ready") {
    return (
      <div className="page">
        <div className="page-inner">
          <WorldStatus status={status} error={error} item={item} />
        </div>
      </div>
    );
  }

  const open = (entry) => entry.revealChapter <= chapter;
  const byChapter = (a, b) => a.revealChapter - b.revealChapter;
  const locations = world.locations.map((l) => ({ ...l, x: clamp(l.x, 5, 95), y: clamp(l.y, 8, 92) }));
  const openLocations = locations.filter(open).sort(byChapter);
  const openCharacters = world.characters.filter(open);
  const openEvents = world.events.filter(open).sort(byChapter);
  const hidden =
    locations.length + world.characters.length + world.events.length -
    openLocations.length - openCharacters.length - openEvents.length;
  const nextUnlock = [...locations, ...world.characters, ...world.events]
    .filter((e) => !open(e))
    .reduce((min, e) => Math.min(min, e.revealChapter), Infinity);

  const selected = openLocations.find((l) => l.id === selectedId) || null;
  const here = (list) => list.filter((e) => e.locationId === selected?.id);

  return (
    <div className="page">
      <div className="page-inner">
        <Link to={`/item/${id}`} className="back-link">← {item.title}</Link>
        <h1 className="page-title">Enter the Book</h1>
        <p className="page-subtitle">{world.premise}</p>

        <ChapterProgress
          chapters={world.chapters}
          chapter={chapter}
          setChapter={(c) => {
            setChapter(c);
            if (selected && selected.revealChapter > c) setSelectedId(null);
          }}
          onSave={saveProgress}
          hint={
            hidden > 0
              ? `${hidden} places, people and moments still hidden. The next one appears when you finish chapter ${nextUnlock}.`
              : "You've uncovered the whole world."
          }
        />

        <div className="world-layout">
          <div className="world-map" role="group" aria-label={`Map of ${item.title}`}>
            <svg className="world-paths" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polyline
                points={openLocations.map((l) => `${l.x},${l.y}`).join(" ")}
                fill="none"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <div className="world-compass" aria-hidden="true">✦<span>N</span></div>

            {locations.map((l) =>
              open(l) ? (
                <button
                  key={l.id}
                  type="button"
                  className={`world-pin${selectedId === l.id ? " active" : ""}`}
                  style={{ left: `${l.x}%`, top: `${l.y}%` }}
                  onClick={() => setSelectedId(l.id)}
                >
                  <span className="world-pin-icon">{l.icon}</span>
                  <span className="world-pin-name">{l.name}</span>
                </button>
              ) : (
                <div
                  key={l.id}
                  className="world-pin locked"
                  style={{ left: `${l.x}%`, top: `${l.y}%` }}
                  title={`Appears in chapter ${l.revealChapter}`}
                >
                  <span className="world-pin-icon">?</span>
                </div>
              )
            )}
          </div>

          <aside className="panel world-side">
            {selected ? (
              <>
                <div className="world-side-icon">{selected.icon}</div>
                <h2>{selected.name}</h2>
                <p>{selected.description}</p>

                {here(openCharacters).length > 0 && (
                  <>
                    <h3>Who you meet here</h3>
                    {here(openCharacters).map((c) => (
                      <div key={c.name} className="world-entry">
                        <b>{c.name}</b> <span className="world-role">{c.role}</span>
                        <p>{c.description}</p>
                        <Link to={`/chat/${id}?character=${encodeURIComponent(c.name)}`} className="world-talk">
                          💬 Talk to {c.name.split(" ")[0]}
                        </Link>
                      </div>
                    ))}
                  </>
                )}

                {here(openEvents).length > 0 && (
                  <>
                    <h3>What happened here</h3>
                    {here(openEvents).map((e) => (
                      <div key={e.title} className="world-entry">
                        <b>{e.title}</b>
                        <p>{e.description}</p>
                      </div>
                    ))}
                  </>
                )}
              </>
            ) : (
              <div className="world-side-empty">
                <div className="world-side-icon">🗺</div>
                <h2>Explore the map</h2>
                <p>Tap a place to see who lives there and what happened. Places marked “?” appear as you read further.</p>
              </div>
            )}
          </aside>
        </div>

        <div className="world-columns">
          <section className="panel details-section">
            <h3 className="section-title">Characters you've met</h3>
            {openCharacters.length === 0 && <p className="world-muted">No one yet. Keep reading!</p>}
            <div className="world-people">
              {openCharacters.map((c) => (
                <Link key={c.name} to={`/chat/${id}?character=${encodeURIComponent(c.name)}`} className="world-person">
                  <span className="world-avatar">{c.name.charAt(0)}</span>
                  <span>
                    <b>{c.name}</b>
                    <small>{c.role}</small>
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <section className="panel details-section">
            <h3 className="section-title">Your journey so far</h3>
            {openEvents.length === 0 && <p className="world-muted">The story is just beginning.</p>}
            <ol className="world-timeline">
              {openEvents.map((e) => (
                <li key={e.title}>
                  <span className="world-percent">Ch. {e.revealChapter}</span>
                  <div>
                    <b>{e.title}</b>
                    <p>{e.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}

export default WorldMapPage;
