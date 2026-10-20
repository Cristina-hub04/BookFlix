import { db } from "./firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

// Posts to the community activity feed on Home, e.g.
// "Ana finished chapter 5 of 19 in The Hobbit" with an optional note.
export const shareProgress = async ({ user, item, text, note }) => {
  if (!user) throw new Error("Sign in to share your progress");
  await addDoc(collection(db, "activityFeed"), {
    userId: user.uid,
    userName: user.displayName || user.email.split("@")[0],
    itemId: item.id,
    itemTitle: item.title,
    text,
    note: (note || "").trim(),
    timestamp: serverTimestamp(),
  });
};
