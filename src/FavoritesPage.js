import React from "react";
import { Link } from "react-router-dom";
import { useShop } from "./ShopContext";
import BookCard from "./BookCard";

function FavoritesPage() {
  const { favorites } = useShop();

  return (
    <div className="page">
      <div className="page-inner">
        <h1 className="page-title">Favorites</h1>
        <p className="page-subtitle">The stories you keep coming back to.</p>

        {favorites.length === 0 ? (
          <div className="panel empty-state">
            <div className="empty-icon">♡</div>
            <h2>No favorites yet</h2>
            <p>Tap the heart on any book to save it here.</p>
            <Link to="/" className="btn">Browse books</Link>
          </div>
        ) : (
          <div className="card-grid">
            {favorites.map((item) => <BookCard key={item.id} item={item} />)}
          </div>
        )}
      </div>
    </div>
  );
}

export default FavoritesPage;
