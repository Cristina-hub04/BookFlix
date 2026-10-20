import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { db } from "./firebase";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";

const timeAgo = (date) => {
  if (!date) return "just now";
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days} d ago` : date.toLocaleDateString();
};

// What readers have shared from their books' pages, newest first, updated live.
function ActivityFeed() {
  const [feed, setFeed] = useState([]);

  useEffect(() => {
    const q = query(collection(db, "activityFeed"), orderBy("timestamp", "desc"), limit(12));
    return onSnapshot(
      q,
      (snapshot) => setFeed(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))),
      (err) => console.error("Error loading the activity feed:", err)
    );
  }, []);

  return (
    <div className="activity">
      <h3>From the reading community</h3>
      {feed.length === 0 && (
        <p className="activity-empty">No one has shared yet. Open a book you're reading and share your progress!</p>
      )}
      <ul>
        {feed.map((f) => {
          const title = f.itemId ? <Link to={`/item/${f.itemId}`}>{f.itemTitle}</Link> : <em>{f.itemTitle}</em>;
          return (
            <li key={f.id}>
              <span className="world-avatar" aria-hidden="true">{(f.userName || "?").charAt(0).toUpperCase()}</span>
              <div>
                <p>
                  {/* entries shared before this version only have a free-text `progress` */}
                  <b>{f.userName}</b> {f.text ? <>{f.text} {title}</> : <>read <em>{f.progress}</em> of {title}</>}
                </p>
                {f.note && <q>{f.note}</q>}
                <small>{timeAgo(f.timestamp?.toDate())}</small>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default ActivityFeed;
