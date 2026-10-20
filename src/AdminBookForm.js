import React, { useState } from "react";
import { addDoc, collection, deleteField, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { GENRES } from "./genres";
import { VIBE_GROUPS } from "./vibes";

const blank = {
  title: "",
  author: "",
  year: "",
  description: "",
  coverUrl: "",
  price: "",
  genres: [],
  vibes: [],
};

const fromBook = (book) => ({
  title: book.title || "",
  author: book.author || book.director || "",
  year: book.year ? String(book.year) : "",
  description: book.description || "",
  coverUrl: book.coverUrl || "",
  price: book.price ? String(book.price) : "",
  genres: book.genres || [],
  vibes: book.vibes || [],
});

// Checks the form and returns { field: message } for everything that needs fixing.
export function validateBook(form) {
  const errors = {};
  const thisYear = new Date().getFullYear();
  if (!form.title.trim()) errors.title = "The title is required.";
  if (!form.author.trim()) errors.author = "The author is required.";
  if (form.year && !(Number.isInteger(Number(form.year)) && Number(form.year) > 0 && Number(form.year) <= thisYear)) {
    errors.year = `Enter a year between 1 and ${thisYear}.`;
  }
  if (form.description.trim().length < 20) errors.description = "Write at least 20 characters.";
  if (!/^https:\/\/\S+$/i.test(form.coverUrl.trim())) errors.coverUrl = "Paste a full image link starting with https://";
  if (form.price && !(Number(form.price.replace(",", ".")) > 0)) errors.price = "Enter a price above 0, or leave it empty.";
  if (form.genres.length === 0) errors.genres = "Pick at least one genre.";
  return errors;
}

function ChipPicker({ options, selected, onChange }) {
  const toggle = (value) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  return (
    <div className="chips">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          className={`chip${selected.includes(o) ? " active" : ""}`}
          onClick={() => toggle(o)}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

// Add a new book (`book` is null) or edit an existing one.
function AdminBookForm({ book, onSaved, onCancel }) {
  const [form, setForm] = useState(book ? fromBook(book) : blank);
  const [errors, setErrors] = useState({});
  const [resetWorld, setResetWorld] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const found = validateBook(form);
    setErrors(found);
    if (Object.keys(found).length) return;

    const data = {
      title: form.title.trim(),
      author: form.author.trim(),
      description: form.description.trim(),
      coverUrl: form.coverUrl.trim(),
      genres: form.genres,
      vibes: form.vibes,
      type: "Book",
    };
    if (form.year) data.year = Number(form.year);
    const price = form.price ? Number(form.price.replace(",", ".")) : null;

    setSaving(true);
    setSaveError("");
    try {
      if (book) {
        await updateDoc(doc(db, "item", book.id), {
          ...data,
          year: form.year ? Number(form.year) : deleteField(),
          price: price ?? deleteField(), // empty = automatic price
          ...(resetWorld ? { world: deleteField(), caseFile: deleteField() } : {}),
        });
      } else {
        await addDoc(collection(db, "item"), { ...data, ...(price ? { price } : {}), createdAt: serverTimestamp() });
      }
      onSaved(book ? "Book updated" : "Book added");
    } catch (err) {
      console.error(err);
      setSaveError(err.code === "permission-denied" ? "You don't have permission to change books." : err.message);
    } finally {
      setSaving(false);
    }
  };

  const field = (name, label, input, hint) => (
    <div className={`field${errors[name] ? " has-error" : ""}`}>
      <label htmlFor={`book-${name}`}>{label}</label>
      {input}
      {errors[name] ? <small className="field-error">{errors[name]}</small> : hint && <small>{hint}</small>}
    </div>
  );

  return (
    <form className="panel admin-form" onSubmit={submit} noValidate>
      <h2 className="section-title">{book ? `Edit “${book.title}”` : "Add a new book"}</h2>

      <div className="admin-form-grid">
        <div className="admin-form-fields">
          {field("title", "Title", <input id="book-title" value={form.title} onChange={set("title")} />)}
          {field("author", "Author", <input id="book-author" value={form.author} onChange={set("author")} />)}
          <div className="admin-form-row">
            {field("year", "Year", <input id="book-year" inputMode="numeric" value={form.year} onChange={set("year")} />)}
            {field(
              "price",
              "Price (lei)",
              <input id="book-price" inputMode="decimal" value={form.price} onChange={set("price")} placeholder="Automatic" />,
              "Leave empty for the automatic price."
            )}
          </div>
          {field(
            "coverUrl",
            "Cover image link",
            <input id="book-coverUrl" value={form.coverUrl} onChange={set("coverUrl")} placeholder="https://..." />
          )}
          {field(
            "description",
            "Description",
            <textarea id="book-description" value={form.description} onChange={set("description")} rows={4} />,
            "A short, spoiler-free blurb."
          )}
        </div>

        <div className="admin-cover-preview">
          {form.coverUrl ? (
            <img src={form.coverUrl} alt="Cover preview" onError={(e) => (e.currentTarget.style.opacity = 0.2)} />
          ) : (
            <span>Cover preview</span>
          )}
        </div>
      </div>

      <div className={`field${errors.genres ? " has-error" : ""}`}>
        <label>Genres</label>
        <ChipPicker options={GENRES} selected={form.genres} onChange={(genres) => setForm((f) => ({ ...f, genres }))} />
        {errors.genres ? <small className="field-error">{errors.genres}</small> : <small>The first one you pick is the main genre.</small>}
      </div>

      <div className="field">
        <label>Vibes</label>
        <ChipPicker
          options={VIBE_GROUPS.flatMap((g) => g.vibes)}
          selected={form.vibes}
          onChange={(vibes) => setForm((f) => ({ ...f, vibes }))}
        />
        <small>Used by Book by Vibe. “mystery” also turns on Plot Detective.</small>
      </div>

      {book && (
        <label className="admin-check">
          <input type="checkbox" checked={resetWorld} onChange={(e) => setResetWorld(e.target.checked)} />
          Rebuild the story map and case file next time someone opens them (use after big changes to the book)
        </label>
      )}

      {saveError && <p className="auth-error">{saveError}</p>}

      <div className="admin-form-actions">
        <button type="submit" className="btn" disabled={saving}>
          {saving ? "Saving..." : book ? "Save changes" : "Add book"}
        </button>
        <button type="button" className="btn-outline" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default AdminBookForm;
