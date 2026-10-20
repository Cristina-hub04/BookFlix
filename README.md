# BookFlix

An online bookstore and reading platform built with **React** and **Firebase**, with its own **Node.js / Express** server that adds AI features powered by **Google Gemini**. Built for the Web App Development course.

Readers can browse and buy books, read them online, track their progress by chapter, write reviews, explore a book's world on an interactive map, talk to its characters and play detective in crime novels, all without spoilers. An admin dashboard manages the catalog and the community.

## Features

| Area | What it does |
| --- | --- |
| Accounts | Sign up / sign in with email and password or Google, password reset, account page with library, favorites and reading progress |
| Catalog | Live search, genre filter, sorting by title, price or year, **Book by Vibe** (find books by mood) |
| Shop | Cart, simulated checkout (buy a book or 30 days of online reading), library, online reader |
| Reading | Progress by chapter (later chapter titles stay hidden), My List, favorites, reviews (one per reader), live community feed |
| AI | **Enter the Book** (spoiler-free map of a book's world), **Character Chat**, **Plot Detective** (evidence board with an AI verdict), site-wide **assistant** |
| Admin | Statistics and charts, add / edit / delete books with a validated form, moderation of reviews and feed posts |

## Architecture

```
React app (browser) ──sign-in, token──▶ Firebase Authentication
        │            ◀──read / write──▶ Cloud Firestore (+ Security Rules)
        │
        └──/api/* with token──▶ AI server (Express) ──▶ Google Gemini
                                checks the token, rate limit,
                                Zod validation, Gemini key lives here
```

- **Frontend** (`src/`): React 19, React Router 7, custom CSS with variables. Heavy pages are lazy-loaded with `React.lazy`.
- **Data**: Cloud Firestore. Each user's cart, favorites, library, progress and list live under `users/{uid}`.
- **Backend** (`server/index.mjs`): Express 5 with the AI endpoints. The browser sends its Firebase ID token and the server verifies it with `firebase-admin`.
- **Security** (`firestore.rules`): anyone can read the catalog; only admins change books; each user reads and writes only their own data.

## Project structure

```
FINALPROJECT/
├── src/                 React app
│   ├── App.js           routes, navbar, protected routes, lazy loading
│   ├── ShopContext.js   account, cart, favorites, library, admin role
│   ├── HomePage.js      catalog, search, genre filter, sorting
│   ├── ItemDetails.js   book page: buy, read online, progress, reviews
│   ├── AdminPage.js     admin dashboard (stats, book CRUD, moderation)
│   ├── WorldMapPage.js  Enter the Book
│   ├── CharacterChatPage.js, DetectivePage.js, AssistantWidget.js
│   └── aiApi.js         calls to the AI server (with the user's token)
├── server/index.mjs     Express AI server
├── firestore.rules      Firestore security rules
├── firebase.json        Firebase CLI config (rules)
└── scripts/             one-time scripts used to seed the catalog
```

## Running locally

Requirements: Node.js 20+ and a free Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).

1. Install the dependencies:
   ```bash
   npm install
   ```
2. Copy `server/.env.example` to `server/.env` and set your key:
   ```
   GEMINI_API_KEY=your-key-here
   ```
3. Start the AI server (first terminal):
   ```bash
   npm run server
   ```
   It should print `Gemini ready`.
4. Start the website (second terminal):
   ```bash
   npm start
   ```
   It opens at http://localhost:3000. Requests to `/api/*` are proxied to the AI server on port 5001.

On Windows, if PowerShell blocks `npm`, use `npm.cmd` instead (for example `npm.cmd start`).

## API

| Endpoint | Access | Description |
| --- | --- | --- |
| `GET /api/health` | Public | Whether the AI is configured |
| `POST /api/world` | Signed in | Generates a book's map: chapters, places, characters, events |
| `POST /api/chat` | Signed in | Streams a character's reply, limited to the reader's chapter |
| `POST /api/case` | Signed in | Generates a mystery's suspects and clues, by chapter |
| `POST /api/case/reveal` | Signed in | Scores the reader's theory (0–100) and reveals the solution |
| `POST /api/assistant` | Public | Streams the site assistant's reply |

All AI endpoints are rate-limited (40 requests per 10 minutes per user or IP) and validate their input with Zod.

## Security rules

The rules in `firestore.rules` are published with the Firebase CLI:

```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules
```

Administrators are listed in the `admins` collection (one document per user id), which can only be edited from the Firebase console.

## Notes

- Payment is simulated; no card details are collected.
- AI-generated maps and case files are generated once per book and cached in Firestore. An admin can have them rebuilt from the dashboard.
- Never commit `server/.env`: it holds the Gemini key and is listed in `.gitignore`.
