# Lumo 🌸⏱️

> A glassmorphism study planner and Pomodoro workspace designed for school and college students.

[![Live Demo](https://img.shields.io/badge/demo-lumobyashu.ai.studio-7c3aed?style=flat-square&logo=google-chrome&logoColor=white)](https://lumobyashu.ai.studio/)
[![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth%20%7C%20Firestore-ffca28?style=flat-square&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Gemini](https://img.shields.io/badge/Google%20Gemini-Flash%203.8-4285f4?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg?style=flat-square)](LICENSE)

**Live Application:** [https://lumobyashu.ai.studio/](https://lumobyashu.ai.studio/)  
**Created with care by:** [Ashu](https://lumobyashu.ai.studio/)

---

## 🌟 Why Lumo?

Most student productivity applications fall into two extremes: rigid, corporate project boards with steep learning curves, or distraction-heavy gamified tools that add cognitive load instead of focus.

**Lumo** is built from the ground up to be an aesthetic, distraction-free study sanctuary. Combining fluid glassmorphism aesthetics with an unflinching timestamp-based Pomodoro engine, procedural ambient audio generators that require no external streaming, real-time peer accountability in live study rooms, and intelligent, server-protected Gemini assistance, Lumo gives students a calm space to organize their semester, protect their focus, and study together.

---

## ✨ Features

### 📅 1. Study Planner (Day · Week · Month)
- **Multi-View Calendar**: Seamlessly toggle between Day, Week, and Month planning views to balance daily tasks against upcoming midterms and finals.
- **Color-Coded Subject Badges**: Tag tasks by academic course (e.g., Physics, Computer Science, Literature, Biology) with subject color tags.
- **Pomodoro Estimator & Subtasks**: Break complex assignments into manageable Pomodoro increments with checkbox tracking.
- **Direct Focus Integration**: Launch any scheduled task directly into the Focus timer with a single click.
- **Friendly Empty States**: Clean, inviting starter cards with immediate action buttons when no tasks are scheduled.

### ⏱️ 2. Focus Timer
- **Drift-Proof Timestamp Engine**: Uses absolute timestamps (`Date.now()`) to track remaining time, ensuring timer accuracy even when browser tabs sleep, computers lock, or the page is refreshed.
- **Classic & Custom Cadences**: Presets for standard Pomodoro (25m Focus / 5m Short Break / 15m Long Break), Ultra-Focus (50m / 10m / 30m), and custom durations from 1 to 180 minutes.
- **Circular SVG Progress Ring**: Visual progress visualization with dynamic browser tab title updates (`(24:18) Focus · Task — Lumo`).
- **Floating Mini-Timer**: Non-intrusive floating bar that keeps time visible while navigating the Planner, Friends, or Stats views.
- **Audio Completion Alerts**: Pleasant, non-jarring synthesized chimes upon timer completion.
- **Daily Study Goal**: Quick modal to set daily target hours (0 to 16 hours in 5-minute increments) with quick presets (1h, 2h, 3h, 4h) and live sidebar progress bar sync.

### 📊 3. Stats, Streaks & Analytics
- **16-Week Activity Heatmap**: GitHub-style daily study intensity matrix tracking consistency over the entire semester.
- **7-Day Bar Chart**: Visual day-by-day study hour breakdown.
- **Course Distribution**: Percentage-based subject breakdown identifying where your study time is allocated.
- **Streak Protection**: Calculates current and longest daily streaks with built-in grace periods.
- **Session History Log**: Chronological log of completed study sessions, durations, and XP earned.

### 🎮 4. Gamification: XP & Levels
- **Focus Rewards**: Earn 1 XP per minute studied + a 10 XP completion bonus for completed sessions.
- **Streak Multipliers**: 1.25× XP multiplier for 3+ day streaks, 1.5× for 7+ days, and 2.0× for 14+ days.
- **5 Academic Tiers**:
  - **Level 1**: Beginner (0 XP)
  - **Level 2**: Learner (100 XP)
  - **Level 3**: Scholar (250 XP)
  - **Level 4**: Expert (450 XP)
  - **Level 5**: Master (700+ XP)
- **Level-Up Celebrations**: Rewarding modal celebrations that motivate sustained study habits.

### 🎨 5. 5 Mood Themes & Glass UI
- **Tailored Glassmorphism**: Translucent frosted glass panels, subtle border reflections, and smooth background gradients.
- **5 Study Themes**:
  - **Calm** (Sky Blue & Slate)
  - **Cozy** (Warm Amber & Wood)
  - **Deep Focus** (Midnight Navy & Indigo)
  - **Fresh** (Sage Green & Mint)
  - **Energetic** (Sunset Coral & Rose)
- **Dynamic Brand Sync**: App logos, favicons, and accent highlights adapt dynamically to the selected theme.

### 🎧 6. Soundscape Mixer & Audio
- **Procedural Web Audio Engine**: Synthesized in real time on the Web Audio API without streaming external audio files:
  - *Nature*: **Ocean Waves** (lowpassed brown swell with foam crests), **Thunderstorm** (rain bed with randomized thunder cracks and rumbles), **Forest Birds** (soft wind bed with multi-species sine chirps), **Night Crickets** (multi-voice frequency pulses).
  - *Noise*: **White Noise**, **Pink Noise**, **Brown Noise**, **Fireplace** (warm bed with irregular crackle clusters and pops).
  - *Brainwaves*: **Alpha Waves** (10 Hz binaural beat for relaxed concentration with headphones).
  - *Beats*: **Lo-Fi Chill** (synthesized Rhodes piano chords, slow boom-bap rhythm, and authentic vinyl crackle).
- **Multi-Track Mixer**: Layer multiple sound generators simultaneously (e.g., Rain + Fireplace + Lo-Fi Chill) with individual volume faders and master gain.
- **3-Second Preview Buttons**: Quick sound checks before committing to a mix.
- **My Music (On-Device Storage)**: Upload local audio files (MP3, WAV, OGG, M4A up to 20MB) stored securely in client-side **IndexedDB** that never leave your device, or paste direct HTTPS audio links.
- **Curated Admin Tracks**: Streamlined study beat library with automatic error classification (*network error*, *not an audio file*, *blocked link*) and a "Hide broken tracks" filter.

### 👥 7. Friends & Leaderboards
- **Unique Handle System**: Claim a student handle (e.g., `@alex_chen`) to connect with classmates.
- **Friend Requests**: Send, accept, or decline pending study friend requests.
- **4-Tab Leaderboard**: Rank among friends across **Today**, **Weekly Hours**, **Streak**, and **All-Time XP**.
- **Live Presence**: Real-time "Studying now" indicators on friend cards when a classmate has an active focus timer.

### 🔒 8. Friend Profiles & Privacy Toggle
- **Glass Profile Drawer**: Click any friend card to view their level, streak, study totals (today, this week, all-time), and 7-day daily study chart.
- **Zero Academic Leaks**: Task titles, assignment notes, and private calendar schedules are **never** shared with friends.
- **Privacy Mode**: Toggle "Share my stats with friends" in Profile & Settings. When turned off, friends see only your display name, level, and streak—your hours and XP remain private.
- **Self Profile View**: View your own stats in the identical layout for visual consistency.

### 🚪 9. Live Study Rooms (Up to 10 Students)
- **Collaborative Virtual Library**: Join or host study rooms via unique 6-character room codes.
- **Host-Controlled Synchronized Timer**: Hosts configure focus and break durations (1 to 180 min); all members sync remaining time from `startedAt + durationSec`.
- **Timer Tamper Protection**: Room duration is read-only for participants and locked while a session is actively running.
- **Room Vibe**: Hosts can select a shared soundscape or beat for the room.
- **Status Sync**: Live member roster indicating who is focusing, taking a break, or idle.

### 🛡️ 10. Admin Panel
- **Role-Gated Access**: Accessible only when `users/{uid}.role === "admin"` in Firestore and verified on the server.
- **Zero Client Backdoors**: No hardcoded passwords, emails, or elevation scripts anywhere in client code.
- **Audio Track Management**: Add, validate, preview, and delete global curated HTTPS tracks.

### 🤖 11. Gemini AI Features (Server-Side Grounded & Protected)
- **AI Study Plan**: Converts syllabus objectives and upcoming exam deadlines into structured study schedules.
- **Task Breakdown**: Uses Gemini to decompose large assignments into discrete, Pomodoro-sized subtasks.
- **Mood Suggestion**: Suggests the optimal mood theme and timer intervals based on current cognitive state.
- **AI Weekly Study Insight**: Summarizes weekly study trends with actionable cognitive coaching advice.
- **Google Search Study Lookup**: Search-grounded academic verification (`gemini-3.8-flash`) with verified web source citations.
- **Guest-Safe UI**: Guests see friendly "Sign in to use AI features" notices that guide them to log in without throwing server errors.

---

## 📸 Screenshots

| Feature | Preview |
|:---:|:---:|
| **Study Planner** | ![Planner](docs/screenshots/planner.png) |
| **Focus Timer** | ![Focus Timer](docs/screenshots/focus.png) |
| **Stats & Heatmap** | ![Stats & Analytics](docs/screenshots/stats.png) |
| **Friends & Leaderboard** | ![Friends & Leaderboard](docs/screenshots/friends.png) |
| **Study Rooms** | ![Study Rooms](docs/screenshots/rooms.png) |
| **Mobile Experience** | ![Mobile View](docs/screenshots/mobile.png) |

> *Note: Place your PNG screenshot files in `docs/screenshots/` matching the filenames above.*

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|:---|:---|:---|
| **Frontend Framework** | [React 19](https://react.dev/) | Component architecture, responsive state, and hooks |
| **Language** | [TypeScript 5](https://www.typescriptlang.org/) | End-to-end type safety and interface definitions |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) | Modern CSS utility classes and fluid glassmorphism |
| **Icons & UI** | [Lucide React](https://lucide.dev/) | Clean, accessible SVG iconography |
| **Audio Engine** | Web Audio API | Procedural sound generation (white/pink/brown noise, binaural waves, synthesizer) |
| **Client Storage** | IndexedDB & LocalStorage | On-device audio file caching (up to 20MB) and offline timer persistence |
| **Backend Server** | [Express](https://expressjs.com/) on Node.js / `tsx` | Secure API proxy, token verification, and rate limiting |
| **Database & Auth** | [Firebase Firestore & Auth](https://firebase.google.com/) | Real-time document sync, Google Sign-In, and strict security rules |
| **Artificial Intelligence** | [@google/genai](https://www.npmjs.com/package/@google/genai) | Gemini 3.8 Flash model for study plans, task breakdowns, insights, and search grounding |
| **Build & Dev Tool** | [Vite 8](https://vitejs.dev/) | Fast development server and optimized production bundling |

---

## 📂 Project Structure

```text
├── .env.example                 # Environment variable templates (no secrets)
├── .gitignore                   # Git exclusion rules for node_modules, build, and .env files
├── firestore.rules              # Zero-trust production Cloud Firestore security rules
├── index.html                   # HTML entry point with Lumo branding and favicon
├── package.json                 # Project dependencies, build scripts, and test commands
├── server.ts                    # Express server with Vite middleware, auth token checks, and Gemini API proxy
├── tsconfig.json                # TypeScript compiler configuration
├── vite.config.ts               # Vite bundler setup and Tailwind CSS integration
├── docs/
│   └── screenshots/             # Screenshot asset directory (.png)
└── src/
    ├── App.tsx                  # Root application router, state persistence, and auth coordinator
    ├── main.tsx                 # React entry point mounting to root DOM element
    ├── index.css                # Global styles and Tailwind CSS imports
    ├── types.ts                 # Shared TypeScript interfaces for tasks, users, rooms, and timer
    ├── components/
    │   ├── AdminTracksView.tsx  # Admin dashboard for curated track management
    │   ├── AuthGateModal.tsx    # Welcome screen, guest entry, Google Sign-In, and username claim
    │   ├── DailyGoalModal.tsx   # Glass modal for custom daily study goal hours/minutes
    │   ├── FocusView.tsx        # Pomodoro timer ring, mood suggestion, and sound mixer
    │   ├── FriendsView.tsx      # Friend roster, username search, and 4-tab leaderboard
    │   ├── HeaderBar.tsx        # Top status bar with XP, level progress, and theme switcher
    │   ├── LumoLogo.tsx         # Responsive SVG brand logo and theme-reactive favicon builder
    │   ├── MoodBackground.tsx   # Ambient animated gradient background layers
    │   ├── PlannerView.tsx      # Day, Week, and Month calendar with AI study planner
    │   ├── ProfileSettingsView.tsx # User profile, timer preferences, and sample data controls
    │   ├── SoundMixerPanel.tsx  # Multi-track procedural audio mixer and My Music player
    │   ├── StatsView.tsx        # Heatmap, 7-day bar chart, subject analytics, and session history
    │   └── StudyRoomsView.tsx   # Real-time multi-user study rooms with host controls
    └── utils/
        ├── firebase.ts          # Firebase SDK initialization and Firestore helpers
        ├── focusLogic.ts        # Pure business logic (timer calculations, XP formula, streak logic)
        ├── focusLogic.test.ts   # Node.js test suite for pure focus logic and branding
        ├── firestore.rules.test.ts # Automated test suite for Firestore security rules
        ├── geminiClient.ts      # Client proxy requesting server-side `/api/gemini/*` endpoints
        ├── seedData.ts          # Default empty states and opt-in demo sample datasets
        ├── soundEngine.ts       # Web Audio API procedural sound generators
        └── themes.ts            # Color palettes and font definitions for all 5 mood themes
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm** or **bun**

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/lumo.git
   cd lumo
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Add your `GEMINI_API_KEY` to `.env` (never commit this file).

4. **Start the development server:**
   ```bash
   npm run dev
   ```
   Open your browser at `http://localhost:3000`.

### Running Tests

Execute the automated test suite for timer calculations, XP multipliers, procedural sound specs, and Firestore security rules:

```bash
npx tsx --test src/utils/focusLogic.test.ts src/utils/firestore.rules.test.ts
```

### Type Checking & Linting

```bash
npm run lint
```

### Production Build

```bash
npm run build
npm run start
```

---

## 🔑 Environment Variables

The project reads environment secrets server-side in `server.ts`. Client code never receives direct access to the Gemini API key.

```bash
# GEMINI_API_KEY: Required for Gemini AI API calls.
# Kept strictly server-side; never exposed to the browser.
GEMINI_API_KEY=

# APP_URL: The URL where this applet is hosted.
# Used for OAuth redirects and canonical links.
APP_URL=

# PORT: Local development server port (defaults to 3000).
PORT=
```

---

## ⚙️ Firebase Setup

To connect Lumo to your own Google Firebase project:

1. **Create a Firebase Project**:
   - Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.
2. **Enable Authentication**:
   - Navigate to **Build** → **Authentication** → **Sign-in method**.
   - Enable **Google Sign-In**.
   - Enable **Email/Password** (for secure Admin login).
3. **Create Cloud Firestore**:
   - Go to **Build** → **Firestore Database** and click **Create Database**.
   - Choose a region close to your users.
4. **Deploy Security Rules**:
   - In the Firestore Database section, navigate to the **Rules** tab.
   - Copy the contents of `firestore.rules` from this repository and click **Publish**.
5. **Configure Authorized Domains**:
   - Under **Authentication** → **Settings** → **Authorized domains**, add:
     - `localhost`
     - Your production domain (e.g., `*.run.app` or custom domain).
6. **Set Up Admin User**:
   - To grant admin access to a user, sign in once to create the user profile document.
   - In the **Firestore Console**, go to `users/{uid}`.
   - Edit the document field `role` and change its value from `"user"` to `"admin"`.
   - Security rules will now allow that user to access the Admin Panel and manage curated tracks.

---

## 🚢 Deployment

Lumo is designed to run seamlessly as a containerized full-stack application on **Google Cloud Run**, **Render**, or **Railway**:

1. **Build Step**:
   ```bash
   npm run build
   ```
2. **Start Step**:
   ```bash
   npm run start
   ```
   *(Executes `node server.ts` running the Express production server on port 3000).*
3. **Set Secrets in your Hosting Provider**:
   - Set `GEMINI_API_KEY` in your platform's secret manager or environment variables.
   - Set `NODE_ENV=production`.

---

## 🔒 Security Architecture

- **Protected Gemini Endpoints**: All AI endpoints (`/api/gemini/plan`, `/api/gemini/breakdown`, `/api/gemini/suggest-mood`, `/api/gemini/insight`, `/api/gemini/search`) are proxied through `server.ts`. They require a valid Firebase ID token in the `Authorization: Bearer <token>` header, verified against Google public certificates.
- **Sliding-Window Rate Limiting**: Built-in in-memory rate limiting restricts each authenticated user to **20 requests per minute**, preventing API key exhaustion.
- **No User Enumeration**: The `firestore.rules` file allows `get` on `users/{uid}` for authenticated users, but explicitly blocks `list`, preventing bad actors from scraping all user accounts.
- **Role Immutability**: The `role` field on `users/{uid}` can only be set or changed directly in the Firebase Console; client writes that attempt to alter roles are rejected by Firestore rules.
- **Input Sanitization**: User input is stripped of HTML and scripts before being rendered or persisted to prevent stored XSS attacks.
- **Honest Client-Side Limits**: Because Lumo is a client-side Pomodoro timer, study hours and XP calculation originate on the user's device. To mitigate abuse, Firestore security rules enforce:
  - XP write delta cap: Maximum `+500 XP` per write operation.
  - Session duration bounds: Sessions must be between 1 and 180 minutes.
  - Monotonic levels: A user's `level` cannot be decreased.
  - Sanity caps on streaks and weekly totals.

For the comprehensive security checklist, refer to [SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md).

---

## 🗺️ Roadmap

- [ ] **Notes to Audio (Text-to-Speech)**: Upload study notes or PDF chapters and listen to them with synchronized read-aloud playback.
- [ ] **Progressive Web App (PWA)**: Offline service workers, background timer notifications, and home screen installation on iOS and desktop.
- [ ] **Native Android App**: Native mobile companion app built with Kotlin and Jetpack Compose.
- [ ] **Exam Countdown Widgets**: Visual exam countdown widgets with customizable priority alarms.

---

## 🤝 Contributing

Contributions, issues, and feature suggestions are welcome!

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m "Add amazing feature"`).
4. Run tests and linting (`npm test && npm run lint`).
5. Push to the branch (`git push origin feature/amazing-feature`).
6. Open a Pull Request.

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Made with ❤️ by <strong>Ashu</strong>
</p>
