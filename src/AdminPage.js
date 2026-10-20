import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "./firebase";
import { useShop, formatPrice } from "./ShopContext";
import AdminBookForm from "./AdminBookForm";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "books", label: "Books" },
  { id: "moderation", label: "Reviews & feed" },
];

const formatDate = (ts) => (ts?.toDate ? ts.toDate().toLocaleDateString() : "");

// A single-series horizontal bar chart: one hue, values labelled at the end of each bar.
function BarList({ rows, format = (v) => v, empty }) {
  if (rows.length === 0) return <p className="world-muted">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="bar-list">
      {rows.map((r) => (
        <li key={r.label} title={`${r.label}: ${format(r.value)}${r.note ? ` (${r.note})` : ""}`}>
          <span className="bar-label">{r.label}</span>
          <span className="bar-track">
            <span className="bar-fill" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="bar-value">{format(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}

function Overview({ data }) {
  const { books, users, reviews, feed, sales } = data;

  const genreRows = Object.entries(
    books.flatMap((b) => b.genres || []).reduce((acc, g) => ({ ...acc, [g]: (acc[g] || 0) + 1 }), {})
  )
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  const byBook = Object.fromEntries(books.map((b) => [b.id, b]));
  const ratings = reviews.reduce((acc, r) => {
    (acc[r.itemId] = acc[r.itemId] || []).push(Number(r.rating) || 0);
    return acc;
  }, {});
  const topRated = Object.entries(ratings)
    .filter(([id]) => byBook[id])
    .map(([id, list]) => ({
      label: byBook[id].title,
      value: list.reduce((s, x) => s + x, 0) / list.length,
      note: `${list.length} review${list.length === 1 ? "" : "s"}`,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const bestSellers = Object.values(sales.perBook)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map((s) => ({ label: s.title, value: s.count }));

  const tiles = [
    { label: "Books", value: books.length },
    { label: "Readers", value: users },
    { label: "Reviews", value: reviews.length },
    { label: "Feed posts", value: feed.length },
    { label: "Sales", value: sales.orders },
    { label: "Revenue", value: formatPrice(sales.revenue) },
  ];

  return (
    <>
      <div className="admin-tiles">
        {tiles.map((t) => (
          <div key={t.label} className="panel admin-tile">
            <span>{t.label}</span>
            <b>{t.value}</b>
          </div>
        ))}
      </div>
      <div className="admin-charts">
        <section className="panel admin-chart">
          <h3>Books per genre</h3>
          <BarList rows={genreRows} empty="No genres yet." />
        </section>
        <section className="panel admin-chart">
          <h3>Best sellers (copies and online passes)</h3>
          <BarList rows={bestSellers} empty="No sales yet." />
        </section>
        <section className="panel admin-chart">
          <h3>Top rated</h3>
          <BarList rows={topRated} format={(v) => `${v.toFixed(1)} ★`} empty="No reviews yet." />
        </section>
      </div>
    </>
  );
}

function BooksTab({ books, onChanged, notify }) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null); // null | "new" | book

  const remove = async (book) => {
    if (!window.confirm(`Delete “${book.title}”? Its reviews are deleted too. This can't be undone.`)) return;
    try {
      const reviews = await getDocs(collection(db, "item", book.id, "reviews"));
      await Promise.all(reviews.docs.map((r) => deleteDoc(r.ref)));
      await deleteDoc(doc(db, "item", book.id));
      notify("Book deleted");
      onChanged();
    } catch (err) {
      console.error(err);
      notify("Couldn't delete the book");
    }
  };

  if (editing) {
    return (
      <AdminBookForm
        book={editing === "new" ? null : editing}
        onCancel={() => setEditing(null)}
        onSaved={(message) => {
          notify(message);
          setEditing(null);
          onChanged();
        }}
      />
    );
  }

  const q = search.trim().toLowerCase();
  const shown = books
    .filter((b) => [b.title, b.author].some((f) => (f || "").toLowerCase().includes(q)))
    .sort((a, b) => (a.title || "").localeCompare(b.title || ""));

  return (
    <>
      <div className="admin-toolbar">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search books..."
          aria-label="Search books"
        />
        <button type="button" className="btn" onClick={() => setEditing("new")}>
          + Add book
        </button>
      </div>
      <div className="panel admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Book</th>
              <th>Genres</th>
              <th>Year</th>
              <th>Price</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {shown.map((b) => (
              <tr key={b.id}>
                <td>
                  <div className="admin-book-cell">
                    <img src={b.coverUrl || "/placeholder.png"} alt="" onError={(e) => (e.currentTarget.src = "/placeholder.png")} />
                    <div>
                      <Link to={`/item/${b.id}`}>{b.title}</Link>
                      <small>{b.author || b.director}</small>
                    </div>
                  </div>
                </td>
                <td>{(b.genres || []).join(", ")}</td>
                <td>{b.year}</td>
                <td>{b.price ? formatPrice(b.price) : <span className="world-muted">auto</span>}</td>
                <td className="admin-row-actions">
                  <button type="button" className="btn-outline" onClick={() => setEditing(b)}>Edit</button>
                  <button type="button" className="btn-link" onClick={() => remove(b)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="results-empty">No books match.</p>}
      </div>
    </>
  );
}

function ModerationTab({ data, onChanged, notify }) {
  const byBook = Object.fromEntries(data.books.map((b) => [b.id, b.title]));

  const remove = async (ref, what) => {
    if (!window.confirm(`Delete this ${what}?`)) return;
    try {
      await deleteDoc(ref);
      notify(`${what[0].toUpperCase()}${what.slice(1)} deleted`);
      onChanged();
    } catch (err) {
      console.error(err);
      notify(`Couldn't delete the ${what}`);
    }
  };

  return (
    <div className="admin-columns">
      <section className="panel admin-list">
        <h3>Latest reviews</h3>
        {data.reviews.length === 0 && <p className="world-muted">No reviews yet.</p>}
        {data.reviews.slice(0, 40).map((r) => (
          <div key={r.ref.path} className="admin-list-row">
            <div>
              <b>{r.userName || "Anonymous reader"}</b> · {"★".repeat(r.rating)} on{" "}
              <Link to={`/item/${r.itemId}`}>{byBook[r.itemId] || "a deleted book"}</Link>
              <p>{r.text}</p>
              <small>{formatDate(r.createdAt)}</small>
            </div>
            <button type="button" className="btn-link" onClick={() => remove(r.ref, "review")}>Delete</button>
          </div>
        ))}
      </section>
      <section className="panel admin-list">
        <h3>Latest feed posts</h3>
        {data.feed.length === 0 && <p className="world-muted">No posts yet.</p>}
        {data.feed.map((f) => (
          <div key={f.id} className="admin-list-row">
            <div>
              <b>{f.userName}</b> {f.text || `read ${f.progress} of`} <i>{f.itemTitle}</i>
              {f.note && <p>“{f.note}”</p>}
              <small>{formatDate(f.timestamp)}</small>
            </div>
            <button type="button" className="btn-link" onClick={() => remove(doc(db, "activityFeed", f.id), "post")}>
              Delete
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}

// Everything the dashboard shows, read in one go. Purchases are summed from each
// reader's account data (users/{uid}/private/shop).
async function loadDashboard() {
  const [books, users, reviews, feed, shops] = await Promise.all([
    getDocs(collection(db, "item")),
    getDocs(collection(db, "users")),
    getDocs(collectionGroup(db, "reviews")), // sorted below: ordering a collection group would need an extra index
    getDocs(query(collection(db, "activityFeed"), orderBy("timestamp", "desc"), limit(50))),
    getDocs(collectionGroup(db, "private")),
  ]);

  const sales = { orders: 0, revenue: 0, perBook: {} };
  const count = (id, title, amount) => {
    sales.orders += 1;
    sales.revenue += amount || 0;
    const entry = (sales.perBook[id] = sales.perBook[id] || { title, count: 0 });
    entry.count += 1;
  };
  shops.docs
    .filter((d) => d.id === "shop")
    .forEach((d) => {
      const { owned = {}, rentals = {} } = d.data();
      Object.values(owned).forEach((b) => count(b.id, b.title, b.price));
      Object.values(rentals).forEach((b) => count(b.id, b.title, b.readPrice));
    });

  return {
    books: books.docs.map((d) => ({ id: d.id, ...d.data() })),
    users: users.size,
    reviews: reviews.docs
      .map((d) => ({ ...d.data(), ref: d.ref, itemId: d.ref.parent.parent.id }))
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)),
    feed: feed.docs.map((d) => ({ id: d.id, ...d.data() })),
    sales,
  };
}

function AdminPage() {
  const { user, authReady, isAdmin, notify } = useShop();
  const [tab, setTab] = useState("overview");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const refresh = useCallback(() => {
    loadDashboard()
      .then(setData)
      .catch((err) => {
        console.error(err);
        setError("Couldn't load the dashboard. Check that your account is an admin and the security rules are published.");
      });
  }, []);

  useEffect(() => {
    if (isAdmin) refresh();
  }, [isAdmin, refresh]);

  if (!authReady) return <div className="page"><p className="results-empty">Loading...</p></div>;

  if (!user || !isAdmin) {
    return (
      <div className="page">
        <div className="page-inner">
          <div className="panel empty-state">
            <div className="empty-icon">🔒</div>
            <h2>Admins only</h2>
            <p>{user ? "Your account doesn't have access to this page." : "Sign in with an admin account to continue."}</p>
            {user ? (
              <Link to="/" className="btn">Back to the collection</Link>
            ) : (
              <Link to="/login" state={{ from: "/admin" }} className="btn">Sign in</Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-inner">
        <h1 className="page-title">Admin</h1>
        <p className="page-subtitle">Manage the collection and keep an eye on the community.</p>

        <div className="auth-tabs admin-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? "active" : ""}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && <p className="auth-error">{error}</p>}
        {!data && !error && <p className="results-empty">Loading the dashboard...</p>}
        {data && tab === "overview" && <Overview data={data} />}
        {data && tab === "books" && <BooksTab books={data.books} onChanged={refresh} notify={notify} />}
        {data && tab === "moderation" && <ModerationTab data={data} onChanged={refresh} notify={notify} />}
      </div>
    </div>
  );
}

export default AdminPage;
