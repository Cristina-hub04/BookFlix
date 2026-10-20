import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useShop, formatPrice, isMovie } from "./ShopContext";

export const lineLabel = (line, rentalDays) =>
  line.kind === "buy"
    ? isMovie(line) ? "Digital copy" : "Book purchase"
    : `${isMovie(line) ? "Watch" : "Read"} online · ${rentalDays} days`;

export const linePrice = (line) => (line.kind === "buy" ? line.price : line.readPrice);

function CartPage() {
  const { cart, cartTotal, removeFromCart, rentalDays } = useShop();
  const navigate = useNavigate();

  return (
    <div className="page">
      <div className="page-inner">
        <h1 className="page-title">Your cart</h1>
        <p className="page-subtitle">
          {cart.length === 0
            ? "Nothing here yet."
            : `${cart.length} item${cart.length === 1 ? "" : "s"} waiting for you.`}
        </p>

        {cart.length === 0 ? (
          <div className="panel empty-state">
            <div className="empty-icon">🛒</div>
            <h2>Your cart is empty</h2>
            <p>Find your next favorite story in our collection.</p>
            <Link to="/" className="btn">Browse books</Link>
          </div>
        ) : (
          <div className="cart-layout">
            <div className="panel">
              {cart.map((line) => (
                <div key={`${line.id}-${line.kind}`} className="cart-line">
                  <img
                    src={line.coverUrl || "/placeholder.png"}
                    alt={line.title}
                    onError={(e) => (e.currentTarget.src = "/placeholder.png")}
                  />
                  <div>
                    <h3><Link to={`/item/${line.id}`}>{line.title}</Link></h3>
                    <p>{line.author}</p>
                    <span className="cart-kind">{lineLabel(line, rentalDays)}</span>
                  </div>
                  <div className="cart-line-right">
                    <span className="cart-line-price">{formatPrice(linePrice(line))}</span>
                    <button className="btn-link" onClick={() => removeFromCart(line.id, line.kind)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <aside className="panel summary">
              <h2>Order summary</h2>
              <div className="summary-row">
                <span>Subtotal</span>
                <span>{formatPrice(cartTotal)}</span>
              </div>
              <div className="summary-row">
                <span>Delivery</span>
                <span>Instant · Free</span>
              </div>
              <div className="summary-total">
                <span>Total</span>
                <span>{formatPrice(cartTotal)}</span>
              </div>
              <button className="btn" onClick={() => navigate("/checkout")}>
                Proceed to checkout
              </button>
              <Link to="/" className="btn-outline">Continue browsing</Link>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

export default CartPage;
