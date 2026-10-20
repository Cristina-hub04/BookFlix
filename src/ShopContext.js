import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

// Favorites, cart and purchases: on the reader's account in Firestore when signed in, in this browser otherwise.
// Checkout is simulated: no real payment is processed.

const RENTAL_DAYS = 30;
const EMPTY = { favorites: {}, cart: [], owned: {}, rentals: {} };

const ShopContext = createContext(null);

const hash = (str) => {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
};

// Items may carry their own `price` / `readPrice`; otherwise a stable price is derived from the id.
export const getPrice = (item) => {
  if (Number(item?.price) > 0) return Number(item.price);
  return 54.99 + 5 * (hash(item?.id || item?.title || "") % 8); // 54,99 – 89,99 lei
};

export const getReadPrice = (item) => {
  if (Number(item?.readPrice) > 0) return Number(item.readPrice);
  return Math.max(9.99, Math.round(getPrice(item) * 0.35) - 0.01);
};

export const formatPrice = (value) =>
  new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON" }).format(value);

export const isMovie = (item) => (item?.type || "").toLowerCase() === "movie";

// Keep only what the cards and pages need, so stored entries stay small.
const snapshot = (item) => ({
  id: item.id,
  title: item.title || "",
  author: item.author || item.director || "",
  year: item.year || "",
  type: item.type || "book",
  genres: item.genres || [],
  coverUrl: item.coverUrl || "",
  description: item.description || "",
  content: item.content || "",
  price: getPrice(item),
  readPrice: getReadPrice(item),
});

const GUEST_KEY = "bookflix:guest";
const legacyKey = (uid) => `bookflix:${uid}`; // where older versions kept each account's data

const load = (key) => {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(key) || "{}") };
  } catch {
    return EMPTY;
  }
};

const forget = (key) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // storage blocked: nothing to clean up
  }
};

// Signed-in readers keep their shop data on their account, in Firestore.
const accountDoc = (uid) => doc(db, "users", uid, "private", "shop");

// Combines two shop states, e.g. what a visitor collected before signing in with their account.
const mergeStates = (a, b) => {
  const rentals = { ...a.rentals };
  for (const [id, r] of Object.entries(b.rentals)) {
    if (!rentals[id] || r.until > rentals[id].until) rentals[id] = r;
  }
  return {
    favorites: { ...a.favorites, ...b.favorites },
    owned: { ...a.owned, ...b.owned },
    rentals,
    cart: [...a.cart, ...b.cart.filter((l) => !a.cart.some((m) => m.id === l.id && m.kind === l.kind))],
  };
};

export function ShopProvider({ children }) {
  const [user, setUser] = useState(auth.currentUser);
  const [authReady, setAuthReady] = useState(false);
  const [state, setState] = useState(EMPTY);
  const [loadedFor, setLoadedFor] = useState(null);
  const [toast, setToast] = useState(null);
  // Profile edits change the signed-in user in place; bumping this re-renders the app with the new details.
  const [, setUserVersion] = useState(0);
  // Browser copies merged into the account, removed once the account has been saved.
  const pendingCleanup = useRef([]);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setAuthReady(true);
      }),
    []
  );

  const uid = user?.uid || null;
  const owner = authReady ? uid || "guest" : null;

  // Admins are listed in the `admins` collection (one document per uid), managed from the Firebase console.
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    setIsAdmin(false);
    if (!uid) return;
    let cancelled = false;
    getDoc(doc(db, "admins", uid))
      .then((snap) => !cancelled && setIsAdmin(snap.exists()))
      .catch(() => {}); // not an admin, or not allowed to look: treat as a regular reader
    return () => {
      cancelled = true;
    };
  }, [uid]);

  // Guests keep their data in this browser. When someone signs in, whatever they
  // collected as a guest is added to their account.
  useEffect(() => {
    if (!owner) return;
    if (!uid) {
      setState(load(GUEST_KEY));
      setLoadedFor(owner);
      return;
    }
    let cancelled = false;
    (async () => {
      let remote = EMPTY;
      try {
        const snap = await getDoc(accountDoc(uid));
        if (snap.exists()) remote = { ...EMPTY, ...snap.data() };
      } catch (err) {
        console.error("Could not load your account data:", err);
      }
      if (cancelled) return;
      setState(mergeStates(mergeStates(remote, load(legacyKey(uid))), load(GUEST_KEY)));
      pendingCleanup.current = [GUEST_KEY, legacyKey(uid)];
      setLoadedFor(owner);
    })();
    return () => {
      cancelled = true;
    };
  }, [owner, uid]);

  useEffect(() => {
    if (!owner || loadedFor !== owner) return;
    if (!uid) {
      try {
        localStorage.setItem(GUEST_KEY, JSON.stringify(state));
      } catch {
        // storage full or blocked: keep working in memory
      }
      return;
    }
    const t = setTimeout(() => {
      setDoc(accountDoc(uid), state)
        .then(() => {
          pendingCleanup.current.forEach(forget);
          pendingCleanup.current = [];
        })
        .catch((err) => console.error("Could not save your account data:", err));
    }, 300);
    return () => clearTimeout(t);
  }, [state, owner, uid, loadedFor]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const notify = useCallback((message) => setToast({ message, at: Date.now() }), []);

  const isFavorite = (id) => Boolean(state.favorites[id]);

  const toggleFavorite = (item) => {
    const wasFavorite = isFavorite(item.id);
    setState((s) => {
      const favorites = { ...s.favorites };
      if (favorites[item.id]) delete favorites[item.id];
      else favorites[item.id] = snapshot(item);
      return { ...s, favorites };
    });
    notify(wasFavorite ? "Removed from favorites" : "Added to favorites ♥");
  };

  const inCart = (id, kind) => state.cart.some((l) => l.id === id && l.kind === kind);

  const addToCart = (item, kind = "buy") => {
    if (inCart(item.id, kind)) {
      notify("Already in your cart");
      return;
    }
    setState((s) => ({
      ...s,
      // buying replaces a pending rental of the same book
      cart: [
        ...s.cart.filter((l) => !(l.id === item.id && kind === "buy")),
        { ...snapshot(item), kind },
      ],
    }));
    notify(kind === "buy" ? "Added to cart" : `${isMovie(item) ? "Online viewing" : "Online reading"} added to cart`);
  };

  const removeFromCart = (id, kind) =>
    setState((s) => ({ ...s, cart: s.cart.filter((l) => !(l.id === id && l.kind === kind)) }));

  const cartTotal = state.cart.reduce((sum, l) => sum + (l.kind === "buy" ? l.price : l.readPrice), 0);

  const hasAccess = (id) => {
    if (state.owned[id]) return true;
    const until = state.rentals[id]?.until;
    return Boolean(until && until > Date.now());
  };

  const rentalUntil = (id) => state.rentals[id]?.until || null;

  const checkout = () => {
    const purchased = state.cart;
    setState((s) => {
      const owned = { ...s.owned };
      const rentals = { ...s.rentals };
      for (const line of s.cart) {
        const { kind, ...item } = line;
        if (kind === "buy") owned[item.id] = { ...item, at: Date.now() };
        else rentals[item.id] = { ...item, until: Date.now() + RENTAL_DAYS * 24 * 60 * 60 * 1000 };
      }
      return { ...s, cart: [], owned, rentals };
    });
    return purchased;
  };

  const libraryItem = (id) => state.owned[id] || state.rentals[id] || state.favorites[id] || null;

  const value = {
    user,
    authReady,
    isAdmin,
    refreshUser: () => setUserVersion((v) => v + 1),
    favorites: Object.values(state.favorites),
    owned: Object.values(state.owned),
    rentals: Object.values(state.rentals),
    cart: state.cart,
    cartTotal,
    isFavorite,
    toggleFavorite,
    inCart,
    addToCart,
    removeFromCart,
    hasAccess,
    rentalUntil,
    checkout,
    libraryItem,
    notify,
    rentalDays: RENTAL_DAYS,
  };

  return (
    <ShopContext.Provider value={value}>
      {children}
      {toast && (
        <div className="toast" key={toast.at} role="status">
          {toast.message}
        </div>
      )}
    </ShopContext.Provider>
  );
}

export const useShop = () => useContext(ShopContext);
