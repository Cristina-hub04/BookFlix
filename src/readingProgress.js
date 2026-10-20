import { useCallback, useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { useShop } from "./ShopContext";

// Each reader's progress is their own: users/{uid}/reading/{bookId} in Firestore,
// or this browser for guests.

const GUEST_KEY = "bookflix-reading:guest";
const NONE = { chapter: 0, progress: 0 };

const readGuest = () => {
  try {
    return JSON.parse(localStorage.getItem(GUEST_KEY) || "{}");
  } catch {
    return {};
  }
};

const writeGuest = (all) => {
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify(all));
  } catch {
    // storage blocked: progress lasts for this visit only
  }
};

const readingDoc = (uid, bookId) => doc(db, "users", uid, "reading", bookId);

// What the account page needs to list a book without loading it again.
export const bookSummary = (book, totalChapters = 0) => ({
  title: book?.title || "",
  author: book?.author || book?.director || "",
  coverUrl: book?.coverUrl || "",
  totalChapters,
});

export function useReadingProgress(bookId) {
  const { user, authReady } = useShop();
  const uid = user?.uid || null;
  const [entry, setEntry] = useState(NONE);

  useEffect(() => {
    if (!authReady) return;
    if (!uid) {
      const saved = readGuest()[bookId];
      setEntry(saved ? { chapter: saved.chapter || 0, progress: saved.progress || 0 } : NONE);
      return;
    }
    let cancelled = false;
    setEntry(NONE);
    getDoc(readingDoc(uid, bookId))
      .then((snap) => {
        if (!cancelled && snap.exists()) {
          setEntry({ chapter: snap.data().chapter || 0, progress: snap.data().progress || 0 });
        }
      })
      .catch((err) => console.error("Could not load your reading progress:", err));
    return () => {
      cancelled = true;
    };
  }, [uid, bookId, authReady]);

  // Saves { chapter, progress } together with a short summary of the book.
  const save = useCallback(
    async (next, summary) => {
      const data = { chapter: next.chapter || 0, progress: Math.round(next.progress || 0), ...summary };
      setEntry({ chapter: data.chapter, progress: data.progress });
      if (!uid) {
        const all = readGuest();
        all[bookId] = { ...data, updatedAt: Date.now() };
        writeGuest(all);
        return;
      }
      await setDoc(readingDoc(uid, bookId), { ...data, updatedAt: serverTimestamp() }, { merge: true });
    },
    [uid, bookId]
  );

  const setChapter = useCallback((chapter) => setEntry((e) => ({ ...e, chapter })), []);
  const setProgress = useCallback((progress) => setEntry((e) => ({ ...e, progress })), []);

  return { ...entry, setChapter, setProgress, save, signedIn: Boolean(uid) };
}

// Every book the reader has started, most recent first.
export async function listReading(uid) {
  const snap = await getDocs(collection(db, "users", uid, "reading"));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));
}
