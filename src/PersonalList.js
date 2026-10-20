import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useShop } from "./ShopContext";
import { loadPersonalList, removeFromPersonalList } from "./addToPersonalList";

// The signed-in reader's own list of books to read next (see App.js: the route requires sign-in).
function PersonalList() {
    const { user, notify } = useShop();
    const [myList, setMyList] = useState(null);

    useEffect(() => {
        if (!user) return;
        loadPersonalList(user)
            .then(setMyList)
            .catch((err) => {
                console.error("Error loading your list:", err);
                setMyList([]);
            });
    }, [user]);

    const handleRemove = async (book) => {
        try {
            await removeFromPersonalList(user, book.id);
            setMyList((list) => list.filter((b) => b.id !== book.id));
            notify("Removed from My List");
        } catch (err) {
            console.error(err);
            notify("Couldn't remove the book");
        }
    };

    return (
        <div className="page">
            <div className="page-inner">
                <h1 className="page-title">My List</h1>
                <p className="page-subtitle">Books you're planning to read next.</p>

                {myList === null ? (
                    <p className="results-empty">Loading...</p>
                ) : myList.length === 0 ? (
                    <div className="panel empty-state">
                        <div className="empty-icon">📚</div>
                        <h2>Your list is empty</h2>
                        <p>Use “+ My List” on any book's page to save it here.</p>
                        <Link to="/" className="btn">Browse books</Link>
                    </div>
                ) : (
                    <div className="account-library">
                        {myList.map((book) => (
                            <div key={book.id} className="panel account-book">
                                <img
                                    src={book.coverUrl || "/placeholder.png"}
                                    alt={book.title}
                                    onError={(e) => (e.currentTarget.src = "/placeholder.png")}
                                />
                                <div>
                                    <h3><Link to={`/item/${book.id}`}>{book.title}</Link></h3>
                                    <p>{book.author}{book.year ? ` · ${book.year}` : ""}</p>
                                </div>
                                <button type="button" className="btn-outline" onClick={() => handleRemove(book)}>
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default PersonalList;
