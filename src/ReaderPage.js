import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import { useShop, isMovie } from "./ShopContext";

const SIZES = [16, 18, 20, 23];

function ReaderPage() {
  const { id } = useParams();
  const { hasAccess, libraryItem } = useShop();
  const [item, setItem] = useState(() => libraryItem(id));
  const [size, setSize] = useState(1);
  const [night, setNight] = useState(false);

  useEffect(() => {
    getDoc(doc(db, "item", id))
      .then((snap) => snap.exists() && setItem({ id, ...snap.data() }))
      .catch((err) => console.error("Error loading item:", err));
  }, [id]);

  if (!hasAccess(id)) {
    return (
      <div className="page">
        <div className="page-inner">
          <div className="panel empty-state">
            <div className="empty-icon">🔒</div>
            <h2>This title is locked</h2>
            <p>Buy it or get online access to start reading.</p>
            <Link to={`/item/${id}`} className="btn">See options</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!item) return <div className="page"><p className="results-empty">Loading...</p></div>;

  const movie = isMovie(item);
  // Full text comes from the item's `content` field in Firestore; until it is filled in, the description is shown.
  const paragraphs = (item.content || item.description || "")
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className={`reader-page${night ? " night" : ""}`}>
      <div className="reader-toolbar">
        <Link to={`/item/${id}`} style={{ color: "inherit" }}>← {item.title}</Link>
        <div className="tools">
          {!movie && (
            <>
              <button onClick={() => setSize((s) => Math.max(0, s - 1))} aria-label="Smaller text">A−</button>
              <button onClick={() => setSize((s) => Math.min(SIZES.length - 1, s + 1))} aria-label="Larger text">A+</button>
            </>
          )}
          <button onClick={() => setNight((n) => !n)}>{night ? "☀ Day" : "☾ Night"}</button>
        </div>
      </div>

      <article className="reader-book" style={{ fontSize: SIZES[size] }}>
        <h1>{item.title}</h1>
        <p className="byline">{item.author || item.director}</p>

        {movie ? (
          item.videoUrl ? (
            <video src={item.videoUrl} controls style={{ width: "100%", borderRadius: 12 }} />
          ) : (
            <div
              style={{
                aspectRatio: "16 / 9",
                borderRadius: 12,
                display: "grid",
                placeItems: "center",
                background: `linear-gradient(rgba(0,0,0,.55), rgba(0,0,0,.55)), url("${item.coverUrl}") center / cover`,
                color: "#fff",
                fontSize: 56,
              }}
            >
              ▶
            </div>
          )
        ) : (
          <>
            <h2>Chapter One</h2>
            {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
          </>
        )}

        {!item.content && !item.videoUrl && (
          <p className="reader-note">
            The full {movie ? "film" : "text"} of this title isn't uploaded yet.
            Add a <code>{movie ? "videoUrl" : "content"}</code> field to the item in Firestore and it will appear here.
          </p>
        )}
      </article>
    </div>
  );
}

export default ReaderPage;
