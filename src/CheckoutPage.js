import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useShop, formatPrice, isMovie } from "./ShopContext";
import { lineLabel, linePrice } from "./CartPage";

const METHODS = ["Card", "PayPal", "Apple Pay"];

// Simulated checkout for the demo: nothing is charged and no payment details are collected.
function CheckoutPage() {
  const { cart, cartTotal, checkout, user, rentalDays } = useShop();
  const [name, setName] = useState(user?.displayName || "");
  const [email, setEmail] = useState(user?.email || "");
  const [method, setMethod] = useState(METHODS[0]);
  const [placing, setPlacing] = useState(false);
  const [order, setOrder] = useState(null);

  const placeOrder = (e) => {
    e.preventDefault();
    setPlacing(true);
    setTimeout(() => {
      setOrder({ lines: checkout(), total: cartTotal });
      setPlacing(false);
    }, 900);
  };

  if (order) {
    return (
      <div className="page">
        <div className="page-inner">
          <div className="panel success">
            <div className="success-icon">✓</div>
            <h1 className="page-title">Thank you{name ? `, ${name.split(" ")[0]}` : ""}!</h1>
            <p className="page-subtitle" style={{ margin: 0 }}>
              Your order of {formatPrice(order.total)} is confirmed. Your new titles are waiting in your library.
            </p>
            <div className="success-list">
              {order.lines.map((line) => (
                <div key={`${line.id}-${line.kind}`} className="mini-line">
                  <span>{line.title}</span>
                  <Link to={`/read/${line.id}`} className="btn-outline">
                    {isMovie(line) ? "Watch now" : "Start reading"}
                  </Link>
                </div>
              ))}
            </div>
            <Link to="/" className="btn">Back to the collection</Link>
          </div>
        </div>
      </div>
    );
  }

  // Purchases are kept on the reader's account, so checkout needs one.
  if (!user && cart.length > 0) {
    return (
      <div className="page">
        <div className="page-inner">
          <div className="panel empty-state">
            <div className="empty-icon">🔑</div>
            <h2>Sign in to finish your order</h2>
            <p>Your books are saved to your account, so you can read them on any device. Your cart will come with you.</p>
            <Link to="/login" state={{ from: "/checkout" }} className="btn">Sign in or create an account</Link>
          </div>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="page">
        <div className="page-inner">
          <div className="panel empty-state">
            <div className="empty-icon">📚</div>
            <h2>Nothing to check out</h2>
            <p>Add a book to your cart first.</p>
            <Link to="/" className="btn">Browse books</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-inner">
        <h1 className="page-title">Checkout</h1>
        <p className="page-subtitle">Almost there. Grab a blanket and a cup of tea.</p>

        <form className="cart-layout" onSubmit={placeOrder}>
          <div className="panel" style={{ padding: 22 }}>
            <div className="form-grid">
              <h3 className="section-title" style={{ margin: 0 }}>Your details</h3>
              <div className="field">
                <label htmlFor="name">Full name</label>
                <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="field">
                <label htmlFor="email">Email</label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>

              <h3 className="section-title" style={{ margin: "10px 0 0" }}>Payment method</h3>
              <div className="pay-methods">
                {METHODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`pay-method${method === m ? " active" : ""}`}
                    onClick={() => setMethod(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <aside className="panel summary">
            <h2>Order summary</h2>
            {cart.map((line) => (
              <div key={`${line.id}-${line.kind}`} className="mini-line">
                <span>
                  {line.title}
                  <br />
                  <small style={{ color: "var(--muted)" }}>{lineLabel(line, rentalDays)}</small>
                </span>
                <span>{formatPrice(linePrice(line))}</span>
              </div>
            ))}
            <div className="summary-total">
              <span>Total</span>
              <span>{formatPrice(cartTotal)}</span>
            </div>
            <button type="submit" className="btn" disabled={placing}>
              {placing ? "Placing order..." : `Pay ${formatPrice(cartTotal)} with ${method}`}
            </button>
            <Link to="/cart" className="btn-outline">Back to cart</Link>
          </aside>
        </form>
      </div>
    </div>
  );
}

export default CheckoutPage;
