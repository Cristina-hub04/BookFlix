import { db } from "./firebase";
import { collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";

// Each reader's "My List" lives on their account: users/{uid}/list/{bookId}.
// Using the book's id as the document id means a book can't be added twice.
const listCollection = (uid) => collection(db, "users", uid, "list");

export async function addToPersonalList(user, item) {
    if (!user) throw new Error("Sign in to keep your own list");
    await setDoc(doc(listCollection(user.uid), item.id), {
        title: item.title || "",
        author: item.author || item.director || "",
        year: item.year || "",
        coverUrl: item.coverUrl || "",
        addedAt: serverTimestamp(),
    });
}

export const removeFromPersonalList = (user, bookId) => deleteDoc(doc(listCollection(user.uid), bookId));

export async function loadPersonalList(user) {
    const snap = await getDocs(query(listCollection(user.uid), orderBy("addedAt", "desc")));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
