import React from "react";
import { Link } from "react-router-dom";
import { useShop, getPrice, formatPrice } from "./ShopContext";

function BookCard({ item }) {
  const { isFavorite, toggleFavorite, hasAccess } = useShop();
  const favorite = isFavorite(item.id);

  return (
    <Link to={`/item/${item.id}`} className="item-card">
      <div className="item-cover">
        <img
          src={item.coverUrl || "/placeholder.png"}
          alt={item.title}
          loading="lazy"
          onError={(e) => (e.currentTarget.src = "/placeholder.png")}
        />
        {(item.genres?.[0] || item.type) && <span className="item-badge">{item.genres?.[0] || item.type}</span>}
        <button
          type="button"
          className={`fav-btn${favorite ? " is-fav" : ""}`}
          aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
          title={favorite ? "Remove from favorites" : "Add to favorites"}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFavorite(item);
          }}
        >
          {favorite ? "♥" : "♡"}
        </button>
      </div>
      <div className="item-info">
        <h3>{item.title}</h3>
        <p>{item.author || item.director}</p>
        <div className="item-meta">
          {hasAccess(item.id) ? (
            <span className="item-owned">In your library</span>
          ) : (
            <span className="item-price">{formatPrice(getPrice(item))}</span>
          )}
          {item.year && <span className="item-year">{item.year}</span>}
        </div>
      </div>
    </Link>
  );
}

export default BookCard;
