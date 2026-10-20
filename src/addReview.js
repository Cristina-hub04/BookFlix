import { db } from "./firebase";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

// One review per reader and book: the review's id is the reader's uid, so posting again updates it.
export async function addReview(itemId, user, rating, text) {
    if (!itemId || typeof itemId !== "string") {
        throw new Error("Invalid itemId");
    }
    if (!user) {
        throw new Error("Sign in to write a review");
    }

    const r = Number(rating);
    if (!Number.isFinite(r) || r < 1 || r > 5) {
        throw new Error("Rating must be between 1 and 5");
    }

    const t = (text || "").trim();
    if (!t) {
        throw new Error("Review text is required");
    }

    await setDoc(doc(db, "item", itemId, "reviews", user.uid), {
        rating: r,
        text: t,
        userId: user.uid,
        userName: user.displayName || user.email.split("@")[0],
        userPhoto: user.photoURL || "",
        createdAt: serverTimestamp(),
    });
}
