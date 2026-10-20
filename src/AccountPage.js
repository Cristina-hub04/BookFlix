import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { doc, setDoc } from "firebase/firestore";
import { sendPasswordResetEmail, signOut, updateProfile } from "firebase/auth";
import { auth, db } from "./firebase";
import { useShop, isMovie } from "./ShopContext";
import BookCard from "./BookCard";
import { listReading } from "./readingProgress";

const formatDate = (value) =>
  new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

function LibraryRow({ item, note, action }) {
  return (
    <div className="panel account-book">
      <img
        src={item.coverUrl || "/placeholder.png"}
        alt={item.title}
        onError={(e) => (e.currentTarget.src = "/placeholder.png")}
      />
      <div>
        <h3><Link to={`/item/${item.id}`}>{item.title}</Link></h3>
        <p>{item.author}</p>
        {note}
      </div>
      {action}
    </div>
  );
}

function AccountPage() {
  const navigate = useNavigate();
  const { user, authReady, isAdmin, owned, rentals, favorites, cart, hasAccess, notify, refreshUser } = useShop();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [reading, setReading] = useState([]);
  const uid = user?.uid;

  // Books this reader has started and not finished, most recent first.
  useEffect(() => {
    if (!uid) return;
    listReading(uid)
      .then((list) => setReading(list.filter((b) => b.progress > 0 && b.progress < 100)))
      .catch((err) => console.error("Error loading your reading:", err));
  }, [uid]);

  if (!authReady) {
    return <div className="page"><p className="results-empty">Loading...</p></div>;
  }

  if (!user) {
    return (
      <div className="page">
        <div className="page-inner">
          <div className="panel empty-state">
            <div className="empty-icon">📖</div>
            <h2>Sign in to see your account</h2>
            <p>Your library, favorites and reading progress live here.</p>
            <Link to="/login" state={{ from: "/account" }} className="btn">Sign in</Link>
          </div>
        </div>
      </div>
    );
  }

  const displayName = user.displayName || user.email.split("@")[0];
  const activeRentals = rentals.filter((r) => hasAccess(r.id) && !owned.some((o) => o.id === r.id));
  const usesPassword = user.providerData.some((p) => p.providerId === "password");

  const saveName = async (e) => {
    e.preventDefault();
    const next = name.trim();
    if (!next) return;
    try {
      await updateProfile(user, { displayName: next });
      await setDoc(doc(db, "users", user.uid), { name: next }, { merge: true });
      refreshUser();
      setEditing(false);
      notify("Name updated");
    } catch (err) {
      console.error(err);
      notify("Couldn't update your name");
    }
  };

  const resetPassword = async () => {
    try {
      await sendPasswordResetEmail(auth, user.email);
      notify(`Password reset link sent to ${user.email}`);
    } catch (err) {
      console.error(err);
      notify("Couldn't send the reset email");
    }
  };

  const logout = async () => {
    await signOut(auth);
    navigate("/");
  };

  const stats = [
    { label: "Books owned", value: owned.length, to: "#library" },
    { label: "Reading online", value: activeRentals.length, to: "#library" },
    { label: "Favorites", value: favorites.length, to: "/favorites" },
    { label: "In your cart", value: cart.length, to: "/cart" },
  ];

  return (
    <div className="page">
      <div className="page-inner">
        <section className="panel account-hero">
          <div className="account-avatar">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
            ) : (
              displayName.charAt(0).toUpperCase()
            )}
          </div>

          <div className="account-hero-info">
            {editing ? (
              <form className="account-name-edit" onSubmit={saveName}>
                <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Your name" autoFocus />
                <button type="submit" className="btn">Save</button>
                <button type="button" className="btn-outline" onClick={() => setEditing(false)}>Cancel</button>
              </form>
            ) : (
              <h1>
                {displayName}
                {isAdmin && <span className="admin-badge">Admin</span>}
              </h1>
            )}
            <p>{user.email}</p>
            {user.metadata?.creationTime && <p>Reader since {formatDate(user.metadata.creationTime)}</p>}
          </div>

          <div className="account-actions">
            {!editing && (
              <button
                type="button"
                className="btn-outline"
                onClick={() => {
                  setName(user.displayName || "");
                  setEditing(true);
                }}
              >
                Edit name
              </button>
            )}
            {usesPassword && (
              <button type="button" className="btn-outline" onClick={resetPassword}>
                Change password
              </button>
            )}
            <button type="button" className="btn" onClick={logout}>
              Log out
            </button>
          </div>
        </section>

        <div className="account-stats">
          {stats.map((s) =>
            s.to.startsWith("#") ? (
              <a key={s.label} href={s.to} className="panel account-stat">
                <b>{s.value}</b>
                <span>{s.label}</span>
              </a>
            ) : (
              <Link key={s.label} to={s.to} className="panel account-stat">
                <b>{s.value}</b>
                <span>{s.label}</span>
              </Link>
            )
          )}
        </div>

        {reading.length > 0 && (
          <section className="account-section">
            <div className="results-head">
              <h2>Continue reading</h2>
            </div>
            <div className="account-library">
              {reading.slice(0, 4).map((b) => (
                <LibraryRow
                  key={b.id}
                  item={b}
                  note={
                    <>
                      <p>
                        {b.chapter && b.totalChapters
                          ? `Chapter ${b.chapter} of ${b.totalChapters}`
                          : `${b.progress}% read`}
                      </p>
                      <div className="account-progress"><span style={{ width: `${b.progress}%` }} /></div>
                    </>
                  }
                  action={<Link to={`/world/${b.id}`} className="btn-outline">Open the map</Link>}
                />
              ))}
            </div>
          </section>
        )}

        <section className="account-section" id="library">
          <div className="results-head">
            <h2>My library</h2>
          </div>
          {owned.length + activeRentals.length === 0 ? (
            <div className="panel account-empty">
              Books you buy or read online will appear here. <Link to="/">Browse the collection</Link>
            </div>
          ) : (
            <div className="account-library">
              {owned.map((b) => (
                <LibraryRow
                  key={`own-${b.id}`}
                  item={b}
                  note={<p>Yours since {formatDate(b.at)}</p>}
                  action={<Link to={`/read/${b.id}`} className="btn-outline">{isMovie(b) ? "Watch" : "Read"}</Link>}
                />
              ))}
              {activeRentals.map((b) => (
                <LibraryRow
                  key={`rent-${b.id}`}
                  item={b}
                  note={<p>Online access until {formatDate(b.until)}</p>}
                  action={<Link to={`/read/${b.id}`} className="btn-outline">{isMovie(b) ? "Watch" : "Read"}</Link>}
                />
              ))}
            </div>
          )}
        </section>

        <section className="account-section">
          <div className="results-head">
            <h2>Favorites</h2>
            {favorites.length > 4 && <Link to="/favorites">See all {favorites.length}</Link>}
          </div>
          {favorites.length === 0 ? (
            <div className="panel account-empty">
              Tap the heart on any book to keep it here. <Link to="/vibes">Find a book by vibe</Link>
            </div>
          ) : (
            <div className="card-grid">
              {favorites.slice(0, 4).map((b) => <BookCard key={b.id} item={b} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default AccountPage;
