// Vocabulary for "Book by Vibe". Each book stores a `vibes` array using these exact labels.
export const VIBE_GROUPS = [
  {
    name: "Setting & weather",
    vibes: [
      "rain", "city at night", "small town", "countryside", "snow & winter", "summer heat",
      "seaside", "wild nature", "desert", "old houses", "school & academia", "faraway worlds",
    ],
  },
  {
    name: "Mood",
    vibes: [
      "mystery", "solitude", "cozy", "dark", "hopeful", "melancholic", "funny",
      "romantic", "tense", "dreamy", "epic", "unsettling", "thought-provoking",
    ],
  },
  {
    name: "Themes",
    vibes: [
      "coming of age", "friendship", "family", "found family", "survival", "self-discovery",
      "rebellion", "obsession", "grief", "ambition", "journey",
    ],
  },
];


// Fraction of the selected vibes a book has, plus the ones it matched.
export function scoreByVibes(item, selected) {
  const own = new Set(item.vibes || []);
  const matched = selected.filter((v) => own.has(v));
  return { matched, score: selected.length ? matched.length / selected.length : 0 };
}

// Plot Detective opens for books tagged with the "mystery" vibe.
export const isMystery = (book) => (book?.vibes || []).includes("mystery");
