import React, { useState } from "react";
import { auth, googleProvider, db } from "./firebase";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { Link, useLocation, useNavigate } from "react-router-dom";

// Turns Firebase error codes into sentences people can act on.
const friendlyError = (err) => {
  switch (err.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "That email and password don't match. Try again or reset your password.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/email-already-in-use":
      return "There's already an account with this email. Sign in instead.";
    case "auth/weak-password":
      return "Choose a password with at least 6 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a moment and try again.";
    case "auth/popup-closed-by-user":
      return "";
    default:
      return err.message;
  }
};

const saveUser = (user, extra = {}) =>
  setDoc(doc(db, "users", user.uid), { email: user.email, name: user.displayName || "", ...extra }, { merge: true });

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState("signin"); // signin | signup
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const done = () => navigate(location.state?.from || "/account", { replace: true });

  const run = async (action) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    run(async () => {
      if (mode === "signin") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        if (name.trim()) await updateProfile(user, { displayName: name.trim() });
        await saveUser(user, { name: name.trim(), createdAt: new Date() });
      }
      done();
    });
  };

  const handleGoogle = () =>
    run(async () => {
      const { user } = await signInWithPopup(auth, googleProvider);
      await saveUser(user);
      done();
    });

  const handleReset = () => {
    if (!email) {
      setError("Type your email above first, then click “Forgot password?” again.");
      return;
    }
    run(async () => {
      await sendPasswordResetEmail(auth, email);
      setNotice(`We sent a link to reset your password to ${email}.`);
    });
  };

  const switchMode = (next) => {
    setMode(next);
    setError("");
    setNotice("");
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <aside
          className="auth-art"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(59, 42, 32, 0.25), rgba(59, 42, 32, 0.85)), url(${process.env.PUBLIC_URL}/Library.jpeg)`,
          }}
        >
          <div className="auth-art-inner">
            <Link to="/" className="auth-logo">Book<span>Flix</span></Link>
            <blockquote>
              “A reader lives a thousand lives before he dies. The man who never reads lives only one.”
              <cite>George R.R. Martin</cite>
            </blockquote>
          </div>
        </aside>

        <section className="auth-form-side">
          <div className="auth-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signin"}
              className={mode === "signin" ? "active" : ""}
              onClick={() => switchMode("signin")}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signup"}
              className={mode === "signup" ? "active" : ""}
              onClick={() => switchMode("signup")}
            >
              Create account
            </button>
          </div>

          <h1 className="auth-title">{mode === "signin" ? "Welcome back" : "Join BookFlix"}</h1>
          <p className="auth-subtitle">
            {mode === "signin"
              ? "Sign in to pick up right where you left off."
              : "Save favorites, build your library and track your reading."}
          </p>

          <button type="button" className="auth-google" onClick={handleGoogle} disabled={busy}>
            <GoogleIcon /> Continue with Google
          </button>

          <div className="auth-divider"><span>or with email</span></div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === "signup" && (
              <div className="field">
                <label htmlFor="auth-name">Name</label>
                <input
                  id="auth-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  placeholder="How should we call you?"
                />
              </div>
            )}

            <div className="field">
              <label htmlFor="auth-email">Email</label>
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="field">
              <div className="auth-label-row">
                <label htmlFor="auth-password">Password</label>
                {mode === "signin" && (
                  <button type="button" className="auth-link" onClick={handleReset}>
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="auth-password">
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  placeholder={mode === "signin" ? "Your password" : "At least 6 characters"}
                  minLength={mode === "signup" ? 6 : undefined}
                  required
                />
                <button
                  type="button"
                  className="auth-link"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {error && <p className="auth-error" role="alert">{error}</p>}
            {notice && <p className="auth-notice" role="status">{notice}</p>}

            <button type="submit" className="btn auth-submit" disabled={busy}>
              {busy ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="auth-switch">
            {mode === "signin" ? "New to BookFlix? " : "Already have an account? "}
            <button type="button" className="auth-link" onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}>
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </section>
      </div>
    </div>
  );
}

export default Login;
