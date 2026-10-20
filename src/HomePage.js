import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { collection, getDocs } from "firebase/firestore";
import ActivityFeed from "./ActivityFeed";
import BookCard from "./BookCard";
import { getPrice } from "./ShopContext";
import "./App.css";
import "./HomePage.css";


const SORTS = {
  featured: { label: "Featured", compare: () => 0 },
  title: { label: "Title A–Z", compare: (a, b) => (a.title || "").localeCompare(b.title || "") },
  priceLow: { label: "Price: low to high", compare: (a, b) => getPrice(a) - getPrice(b) },
  priceHigh: { label: "Price: high to low", compare: (a, b) => getPrice(b) - getPrice(a) },
  newest: { label: "Newest first", compare: (a, b) => (Number(b.year) || 0) - (Number(a.year) || 0) },
  oldest: { label: "Oldest first", compare: (a, b) => (Number(a.year) || 0) - (Number(b.year) || 0) },
};

function HomePage() {
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("all");
  const [sort, setSort] = useState("featured");
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const snapshot = await getDocs(collection(db, "item"));
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllItems(data);
      } catch (err) {
        console.error("Error fetching items:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, []);

  // Genres in the collection, most common first, with how many books each has.
  const genreCounts = allItems
    .flatMap(item => item.genres || [])
    .reduce((counts, g) => ({ ...counts, [g]: (counts[g] || 0) + 1 }), {});
  const genres = Object.keys(genreCounts).sort((a, b) => genreCounts[b] - genreCounts[a] || a.localeCompare(b));

  const q = title.trim().toLowerCase();
  const results = allItems
    .filter(item =>
      (genre === "all" || (item.genres || []).includes(genre)) &&
      [item.title, item.author, item.director]
        .some(field => (field || "").toLowerCase().includes(q))
    )
    .sort(SORTS[sort].compare);

  return (
    <div className="home">
      <video className="home-video" autoPlay loop muted playsInline>
        <source src="/videoloop.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      <div className="home-overlay" />

      <div className="home-content fadeSlide">
        <section className="hero">
          <h1 className="hero-title">
            Welcome to Book<span>Flix</span>
          </h1>
          <p className="hero-subtitle">
            Curl up with a good story. Buy it, read it online or save it for later.
          </p>

          <form className="search-bar" onSubmit={(e) => e.preventDefault()}>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Search by title, author or director..."
              aria-label="Search"
            />
            <button type="submit" className="btn">Search</button>
          </form>
        </section>

        <section className="results">
          <div className="results-head">
            <h2>
              {q ? "Search results" : genre === "all" ? "Our collection" : genre}
              {!loading && <span className="results-total">{results.length} books</span>}
            </h2>
            <label className="sort-select">
              <span>Sort by</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                {Object.entries(SORTS).map(([key, s]) => (
                  <option key={key} value={key}>{s.label}</option>
                ))}
              </select>
            </label>
          </div>

          {genres.length > 0 && (
            <div className="chips genre-chips" role="group" aria-label="Filter by genre">
              <button
                type="button"
                className={`chip${genre === "all" ? " active" : ""}`}
                onClick={() => setGenre("all")}
              >
                All genres
              </button>
              {genres.map(g => (
                <button
                  key={g}
                  type="button"
                  className={`chip${genre === g ? " active" : ""}`}
                  onClick={() => setGenre(g)}
                >
                  {g} <span className="chip-count">{genreCounts[g]}</span>
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="card-grid">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="item-card skeleton" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <p className="results-empty">
              No books found.{" "}
              {genre !== "all" ? (
                <button type="button" className="btn-link" onClick={() => setGenre("all")}>Show all genres</button>
              ) : (
                "Try another title or author."
              )}
            </p>
          ) : (
            <div className="card-grid">
              {results.map(item => <BookCard key={item.id} item={item} />)}
            </div>
          )}
        </section>

        <section className="feed-panel">
          <ActivityFeed />
        </section>
      </div>
    </div>
  );
}

export default HomePage;
