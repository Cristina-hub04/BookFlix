import { BrowserRouter, Routes, Route, Link, NavLink, Navigate, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect, useState } from "react";
import ItemDetails from "./ItemDetails";
import PersonalList from "./PersonalList";
import HomePage from "./HomePage";
import CartPage from "./CartPage";
import FavoritesPage from "./FavoritesPage";
import AssistantWidget from "./AssistantWidget";
import "./Navbar.css";
import "./Shop.css";
import "./World.css";
import "./Assistant.css";
import "./Account.css";
import "./Detective.css";
import "./Admin.css";
import Login from "./Login";
import { signOut } from "firebase/auth";
import { auth } from "./firebase";
import { ShopProvider, useShop } from "./ShopContext";

// Heavier pages are downloaded only when someone opens them, so Home loads faster.
const CheckoutPage = lazy(() => import("./CheckoutPage"));
const ReaderPage = lazy(() => import("./ReaderPage"));
const VibePage = lazy(() => import("./VibePage"));
const WorldMapPage = lazy(() => import("./WorldMapPage"));
const CharacterChatPage = lazy(() => import("./CharacterChatPage"));
const AccountPage = lazy(() => import("./AccountPage"));
const DetectivePage = lazy(() => import("./DetectivePage"));
const AdminPage = lazy(() => import("./AdminPage"));


// Pages that only make sense with an account: guests are sent to sign in, then brought back.
function RequireAuth({ children }) {
  const { user, authReady } = useShop();
  const location = useLocation();
  if (!authReady) return <div className="page"><p className="results-empty">Loading...</p></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}


function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}


function Navbar() {
  const { user, isAdmin, cart, favorites } = useShop();
  const { pathname } = useLocation();
  // On phones the links fold behind a menu button; opening another page closes it.
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <header className="navbar">
      <div className="nav-container">
        <Link to="/" style={{ textDecoration: "none" }}>
          <h2 className="logo">Book<span>Flix</span></h2>
        </Link>
        <button
          type="button"
          className="nav-toggle"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="main-nav"
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? "×" : "☰"}
          {!menuOpen && cart.length > 0 && <span className="cart-badge">{cart.length}</span>}
        </button>
        <nav id="main-nav" className={`nav-links${menuOpen ? " open" : ""}`}>
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/vibes">By Vibe</NavLink>
          <NavLink to="/my-list">My List</NavLink>
          <NavLink to="/favorites">
            Favorites{favorites.length > 0 ? ` (${favorites.length})` : ""}
          </NavLink>
          {isAdmin && <NavLink to="/admin">Admin</NavLink>}
          <NavLink to="/cart" className="nav-cart">
            Cart
            {cart.length > 0 && <span className="cart-badge">{cart.length}</span>}
          </NavLink>
          {user ? (
            <>
              <NavLink to="/account" className="nav-user" title="My account">
                <span className="nav-user-avatar" aria-hidden="true">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
                  ) : (
                    (user.displayName || user.email).charAt(0).toUpperCase()
                  )}
                </span>
                {user.displayName || user.email.split("@")[0]}
              </NavLink>
              <button className="nav-logout" onClick={() => signOut(auth)}>Logout</button>
            </>
          ) : (
            <NavLink to="/login">Sign in</NavLink>
          )}
        </nav>
      </div>
    </header>
  );
}


function App() {
  return (
    <BrowserRouter>
      <ShopProvider>
        <ScrollToTop />
        <Navbar />

        <main>
          <Suspense fallback={<div className="page"><p className="results-empty">Loading...</p></div>}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/item/:id" element={<ItemDetails />} />
            <Route path="/my-list" element={<RequireAuth><PersonalList /></RequireAuth>} />
            <Route path="/favorites" element={<FavoritesPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/read/:id" element={<ReaderPage />} />
            <Route path="/vibes" element={<VibePage />} />
            <Route path="/world/:id" element={<WorldMapPage />} />
            <Route path="/chat/:id" element={<CharacterChatPage />} />
            <Route path="/case/:id" element={<DetectivePage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/account" element={<RequireAuth><AccountPage /></RequireAuth>} />
            <Route path="/admin" element={<AdminPage />} />
            <Route
              path="*"
              element={
                <div className="page">
                  <div className="page-inner">
                    <div className="panel empty-state">
                      <div className="empty-icon">📖</div>
                      <h2>This page isn't on our shelves</h2>
                      <p>The link may be old or mistyped.</p>
                      <Link to="/" className="btn">Back to the collection</Link>
                    </div>
                  </div>
                </div>
              }
            />
          </Routes>
          </Suspense>
        </main>

        <AssistantWidget />
      </ShopProvider>
    </BrowserRouter>
  );
}

export default App;
