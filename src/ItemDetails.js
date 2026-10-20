import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
    doc,
    getDoc,
    collection,
    getDocs,
    query,
    orderBy,
} from "firebase/firestore";
import { db } from "./firebase";
import { addToPersonalList } from "./addToPersonalList";
import { addReview } from "./addReview";
import { useShop, getPrice, getReadPrice, formatPrice, isMovie } from "./ShopContext";
import { ChapterProgress } from "./WorldShared";
import { bookSummary, useReadingProgress } from "./readingProgress";
import { shareProgress } from "./shareProgress";
import { isMystery } from "./vibes";

function StarRating({ value = 0, onChange, readOnly = false, size = 22 }) {
    const v = Number(value) || 0;

    return (
        <div style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
            {[1, 2, 3, 4, 5].map((star) => {
                const filled = star <= v;
                return (
                    <span
                        key={star}
                        onClick={() => {
                            if (!readOnly && onChange) onChange(star);
                        }}
                        style={{
                            cursor: readOnly ? "default" : "pointer",
                            fontSize: size,
                            lineHeight: 1,
                            color: filled ? "var(--gold)" : "#d9cdbb",
                            userSelect: "none",
                        }}
                        title={`${star} star${star === 1 ? "" : "s"}`}
                    >
            ★
          </span>
                );
            })}
        </div>
    );
}

function ItemDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const shop = useShop();

    const [item, setItem] = useState(null);

    // The signed-in reader's own progress on this book.
    const reading = useReadingProgress(id);
    const [shareNote, setShareNote] = useState("");
    const [sharing, setSharing] = useState(false);


    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");


    const [reviews, setReviews] = useState([]);
    const [rating, setRating] = useState(5);
    const [reviewText, setReviewText] = useState("");
    const [savingReview, setSavingReview] = useState(false);

    const fetchReviews = async (itemId) => {
        const reviewsRef = collection(db, "item", itemId, "reviews");
        const q = query(reviewsRef, orderBy("createdAt", "desc"));
        const snap = await getDocs(q);

        const data = snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
        }));

        setReviews(data);
    };

    useEffect(() => {
        if (!id) {
            setError("No item ID provided.");
            setLoading(false);
            return;
        }

        const fetchItem = async () => {
            try {
                const docRef = doc(db, "item", id);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setItem({ id, ...data });

                    await fetchReviews(id);
                } else {
                    setError("Item not found.");
                }
            } catch (err) {
                console.error(err);
                setError("Failed to fetch item.");
            } finally {
                setLoading(false);
            }
        };

        fetchItem();
    }, [id]);

    // A reader who already reviewed this book sees their review ready to edit.
    const uid = shop.user?.uid;
    const myReview = reviews.find((r) => r.id === uid);
    useEffect(() => {
        if (!myReview) return;
        setRating(myReview.rating);
        setReviewText(myReview.text);
    }, [myReview]);

    const totalChapters = item?.world?.chapters?.length || 0;

    const handleSaveProgress = async () => {
        try {
            await reading.save({ chapter: reading.chapter, progress: reading.progress }, bookSummary(item, totalChapters));
            shop.notify("Progress saved");
        } catch (err) {
            console.error(err);
            shop.notify("Failed to save progress");
        }
    };

    const saveChapterProgress = (chapter) =>
        reading.save({ chapter, progress: (chapter / totalChapters) * 100 }, bookSummary(item, totalChapters));

    // "finished chapter 5 of 19 in" / "is 40% through"
    const progressText = () =>
        totalChapters && reading.chapter
            ? reading.chapter >= totalChapters
                ? "finished"
                : `finished chapter ${reading.chapter} of ${totalChapters} in`
            : reading.progress >= 100
                ? "finished"
                : `is ${reading.progress}% through`;

    const handleShare = async () => {
        try {
            setSharing(true);
            await shareProgress({ user: shop.user, item, text: progressText(), note: shareNote });
            setShareNote("");
            shop.notify("Shared with the community");
        } catch (err) {
            console.error(err);
            shop.notify(err.message || "Couldn't share your progress");
        } finally {
            setSharing(false);
        }
    };

    const handleAddToList = async () => {
        try {
            if (!shop.user) {
                navigate("/login", { state: { from: `/item/${id}` } });
                return;
            }
            await addToPersonalList(shop.user, item);
            shop.notify("Added to My List");
        } catch (err) {
            console.error(err);
            shop.notify("Failed to add to your list");
        }
    };

    const handleSubmitReview = async () => {
        try {
            setSavingReview(true);

            await addReview(id, shop.user, rating, reviewText);

            await fetchReviews(id);

            shop.notify("Thanks for your review!");
        } catch (err) {
            console.error(err);
            shop.notify(err.message || "Failed to add review");
        } finally {
            setSavingReview(false);
        }
    };

    const avgRating =
        reviews.length > 0
            ? reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0) / reviews.length
            : null;
    const avgRounded = avgRating ? Math.round(avgRating) : 0;

    if (loading) {
        return (
            <div className="page">
                <div className="page-inner"><p className="results-empty">Loading...</p></div>
            </div>
        );
    }
    if (error || !item) {
        return (
            <div className="page">
                <div className="page-inner">
                    <div className="panel empty-state">
                        <h2>{error || "No item data."}</h2>
                        <Link to="/" className="btn">Back to the collection</Link>
                    </div>
                </div>
            </div>
        );
    }

    const movie = isMovie(item);
    const readVerb = movie ? "Watch" : "Read";
    const favorite = shop.isFavorite(id);
    const owned = shop.hasAccess(id);
    const rentalUntil = shop.rentalUntil(id);

    const readNow = () => {
        shop.addToCart(item, "rent");
        navigate("/checkout");
    };

    return (
        <div className="page">
            <div className="page-inner">
                <button className="back-link" onClick={() => navigate(-1)}>
                    ← Back
                </button>

                <div className="details">
                    <div className="details-cover">
                        <img
                            src={item.coverUrl || "/placeholder.png"}
                            alt={item.title}
                            onError={(e) => (e.currentTarget.src = "/placeholder.png")}
                        />
                    </div>

                    <div>
                        {(item.genres?.length ? item.genres : [item.type].filter(Boolean)).map((g) => (
                            <span key={g} className="details-type">{g}</span>
                        ))}
                        <h1 className="details-title">{item.title}</h1>
                        <p className="details-author">
                            by {item.author || item.director}
                            {item.year ? ` · ${item.year}` : ""}
                        </p>

                        <div className="details-rating">
                            <StarRating value={avgRounded} readOnly={true} size={18} />
                            {avgRating !== null ? (
                                <span>
                                    <b>{avgRating.toFixed(1)}</b> · {reviews.length} review
                                    {reviews.length === 1 ? "" : "s"}
                                </span>
                            ) : (
                                <span>No reviews yet</span>
                            )}
                        </div>

                        {item.description && <p className="details-description">{item.description}</p>}

                        <div className="panel buy-box">
                            {owned && (
                                <div className="access-banner">
                                    <span>
                                        {rentalUntil && !shop.libraryItem(id)?.at
                                            ? `✓ Online access until ${new Date(rentalUntil).toLocaleDateString()}`
                                            : "✓ This title is in your library"}
                                    </span>
                                    <Link to={`/read/${id}`} className="btn">
                                        {readVerb} now
                                    </Link>
                                </div>
                            )}

                            <div className="buy-options">
                                <div className="buy-option">
                                    <span className="label">{movie ? "Buy digital copy" : "Buy the book"}</span>
                                    <span className="price">{formatPrice(getPrice(item))}</span>
                                    <span className="hint">Yours to keep, forever.</span>
                                    <button
                                        className="btn"
                                        onClick={() => shop.addToCart(item, "buy")}
                                        disabled={shop.inCart(id, "buy")}
                                    >
                                        {shop.inCart(id, "buy") ? "In your cart" : "Add to cart"}
                                    </button>
                                </div>

                                <div className="buy-option">
                                    <span className="label">{readVerb} online</span>
                                    <span className="price">{formatPrice(getReadPrice(item))}</span>
                                    <span className="hint">{shop.rentalDays} days of unlimited online access.</span>
                                    <button className="btn-outline" onClick={readNow}>
                                        {readVerb} online
                                    </button>
                                </div>
                            </div>

                            <div className="buy-secondary">
                                <button
                                    className={`fav-toggle${favorite ? " is-fav" : ""}`}
                                    onClick={() => shop.toggleFavorite(item)}
                                >
                                    {favorite ? "♥ In favorites" : "♡ Add to favorites"}
                                </button>
                                <button className="fav-toggle" onClick={handleAddToList}>
                                    + My List
                                </button>
                                {shop.cart.length > 0 && (
                                    <Link to="/cart" className="fav-toggle" style={{ textDecoration: "none" }}>
                                        View cart ({shop.cart.length})
                                    </Link>
                                )}
                            </div>
                        </div>

                        <div className="story-features">
                            <Link to={`/world/${id}`} className="story-feature">
                                <span className="icon">🗺</span>
                                <span>
                                    <b>Enter the Book</b>
                                    <small>Explore its places, people and moments, spoiler-free.</small>
                                </span>
                            </Link>
                            <Link to={`/chat/${id}`} className="story-feature">
                                <span className="icon">💬</span>
                                <span>
                                    <b>Character Chat</b>
                                    <small>Talk with the characters you've met so far.</small>
                                </span>
                            </Link>
                            {isMystery(item) && (
                                <Link to={`/case/${id}`} className="story-feature">
                                    <span className="icon">🕵</span>
                                    <span>
                                        <b>Plot Detective</b>
                                        <small>Pin suspects and clues on a board, then test your theory.</small>
                                    </span>
                                </Link>
                            )}
                        </div>

                        {totalChapters ? (
                            <ChapterProgress
                                chapters={item.world.chapters}
                                chapter={Math.min(reading.chapter, totalChapters)}
                                setChapter={reading.setChapter}
                                onSave={saveChapterProgress}
                            />
                        ) : (
                        <div className="panel details-section">
                            <h3 className="section-title">{movie ? "Watching" : "Reading"} progress</h3>
                            <p className="world-muted" style={{ marginTop: 0 }}>
                                Open <Link to={`/world/${id}`}>Enter the Book</Link> once to track your reading by chapter.
                            </p>
                            <div className="progress-row">
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={reading.progress}
                                    onChange={(e) => reading.setProgress(Number(e.target.value))}
                                />
                                <span>{reading.progress}%</span>
                            </div>
                            <button className="btn-outline" onClick={handleSaveProgress}>
                                Save progress
                            </button>
                        </div>
                        )}

                        {(reading.chapter > 0 || reading.progress > 0) && (
                            <div className="panel details-section share-progress">
                                <h3 className="section-title">Share your progress</h3>
                                {shop.user ? (
                                    <>
                                        <p className="world-muted">
                                            <b>{shop.user.displayName || shop.user.email.split("@")[0]}</b> {progressText()}{" "}
                                            <i>{item.title}</i>
                                        </p>
                                        <div className="share-row">
                                            <input
                                                value={shareNote}
                                                onChange={(e) => setShareNote(e.target.value)}
                                                placeholder="Add a thought (optional)"
                                                maxLength={200}
                                                aria-label="Add a note"
                                            />
                                            <button className="btn" onClick={handleShare} disabled={sharing}>
                                                {sharing ? "Sharing..." : "Share"}
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <p className="world-muted">
                                        <Link to="/login" state={{ from: `/item/${id}` }}>Sign in</Link> to share your
                                        progress with the reading community.
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="panel details-section">
                            <h3 className="section-title">Reviews</h3>

                            {shop.user ? (
                                <div className="review-form">
                                    <StarRating value={rating} onChange={setRating} readOnly={false} />
                                    <textarea
                                        value={reviewText}
                                        onChange={(e) => setReviewText(e.target.value)}
                                        placeholder="What did you think?"
                                    />
                                    <button className="btn" onClick={handleSubmitReview} disabled={savingReview}>
                                        {savingReview ? "Saving..." : myReview ? "Update your review" : "Post review"}
                                    </button>
                                </div>
                            ) : (
                                <p className="world-muted">
                                    <Link to="/login" state={{ from: `/item/${id}` }}>Sign in</Link> to write a review.
                                </p>
                            )}

                            <div style={{ marginTop: 18 }}>
                                {reviews.map((r) => (
                                    <div key={r.id} className="review">
                                        <div className="review-head">
                                            <span className="world-avatar" aria-hidden="true">
                                                {r.userPhoto ? (
                                                    <img src={r.userPhoto} alt="" referrerPolicy="no-referrer" />
                                                ) : (
                                                    (r.userName || "?").charAt(0).toUpperCase()
                                                )}
                                            </span>
                                            <div>
                                                <b>
                                                    {r.userName || "Anonymous reader"}
                                                    {r.id === uid && <span className="review-you"> (you)</span>}
                                                </b>
                                                <small>{r.createdAt?.toDate().toLocaleDateString()}</small>
                                            </div>
                                            <StarRating value={r.rating} readOnly={true} size={16} />
                                        </div>
                                        <p>{r.text}</p>
                                    </div>
                                ))}
                                {item.reviews?.map((rev, idx) => (
                                    <div key={`legacy-${idx}`} className="review">
                                        <p>{rev}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ItemDetails;
