# Session Notes — The Intelligent Bistro

**Project:** Viridien AI Full-Stack Engineering Internship challenge  
**Repository:** `viridien_project_intelligent_bistro`  
**Session span:** Project inception through troubleshooting and demo prep (May 2026)

This document captures decisions, setup steps, issues, and fixes from our working sessions (Cursor + user), so you can refer back without re-reading the full chat.

---

## 1. Project goal

Build **The Intelligent Bistro**:

- **React Native (Expo)** mobile app — browse menu, shopping cart, conversational AI ordering
- **Node.js backend** — natural language → structured JSON cart actions
- **Polished UI** — NativeWind, dark bistro theme
- **Submission:** GitHub repo + ~5 min Loom (Menu, AI cart, Cart, brief code tour)

---

## 2. How the project was built

### Initial approach (slow)

- Ran `npx create-expo-app@latest mobile` — hung / ran ~1.7+ hours and was interrupted
- **Cause:** First-time download of Expo CLI + hundreds of npm packages (200MB+), cold cache, Windows/network/antivirus
- **Result:** Project folder was still empty; nothing committed from that command

### Faster approach (used successfully)

- **Manual scaffold** of `backend/` and `mobile/`
- Separate `npm install` in each folder (~16s backend, ~2 min mobile)
- Verified API with `Invoke-RestMethod` on `/health` and `/api/chat`

### Monorepo layout

```
viridien_project_intelligent_bistro/
├── backend/          # Express + TypeScript API
├── mobile/           # Expo 52 + Expo Router + NativeWind + Zustand
├── docker-compose.yml
├── README.md         # Detailed architecture + setup
└── docs/
    └── SESSION_NOTES.md   # This file
```

---

## 3. What was implemented

### Backend (`backend/`)

| Piece | Purpose |
|-------|---------|
| `src/data/menu.ts` | 11 menu items, modifiers, aliases |
| `src/services/ruleBasedParser.ts` | Offline NLP → `CartAction[]` |
| `src/services/aiService.ts` | OpenAI `gpt-4o-mini` (optional) + fallback to rules |
| `src/routes/menu.ts` | `GET /api/menu` |
| `src/routes/chat.ts` | `POST /api/chat` (Zod validation) |
| `src/index.ts` | Express on port 3001, CORS, `/health` |

**AI modes:**

- `OPENAI_API_KEY` set → Chat Completions, `response_format: json_object`, temperature `0.2`, model `gpt-4o-mini` (override via `OPENAI_MODEL`)
- No key → rule-based parser only (`parsedBy: "rules"`)

**Example verified:**

> Add two spicy chicken sandwiches and a large water

→ `ADD` actions with `spice: hot` and `size: large`.

### Mobile (`mobile/`)

| Piece | Purpose |
|-------|---------|
| `app/(tabs)/index.tsx` | Menu + categories |
| `app/(tabs)/assistant.tsx` | AI chat, applies actions to cart |
| `app/(tabs)/cart.tsx` | Cart lines, qty, tax, checkout CTA |
| `src/store/cartStore.ts` | Zustand cart state |
| `src/store/menuStore.ts` | Menu fetch from API |
| `src/lib/api.ts` | HTTP client; Android emulator → `10.0.2.2:3001` |
| `components/*` | MenuItemCard, CartLineItem, ChatBubble, etc. |

### Docker

- `backend/Dockerfile` — multi-stage Node 22 Alpine build
- `docker-compose.yml` — single service `api` on port 3001
- **Important:** Docker runs **backend only**, not the Expo app

### Documentation

- `README.md` expanded: architecture, AI specs, API reference, Docker + local setup, troubleshooting, Loom checklist

---

## 4. Environment & configuration

### Backend (`backend/.env`)

```env
PORT=3001
OPENAI_API_KEY=          # optional
OPENAI_MODEL=gpt-4o-mini
```

Copy from `backend/.env.example`. Never commit `.env`.

### Mobile (`mobile/app.json`)

```json
"extra": {
  "apiUrl": "http://localhost:3001"
}
```

- **Web / iOS simulator (same PC):** `localhost:3001`
- **Android emulator:** auto `10.0.2.2:3001` in `api.ts`
- **Physical phone:** use PC LAN IP, e.g. `http://192.168.1.42:3001`

---

## 5. How to run (quick reference)

### API — Docker

```powershell
cd viridien_project_intelligent_bistro
docker compose up --build -d
Invoke-RestMethod http://localhost:3001/health
```

Requires **Docker Desktop running**. Rebuild after **backend** code changes: `docker compose up --build -d`.

### API — Local (no Docker)

```powershell
cd backend
npm run dev
```

### Mobile — Web (easiest on Windows)

```powershell
cd mobile
npx expo start --web --clear
```

Open `http://localhost:8081`.

### Logs

```powershell
docker compose logs -f api          # API in Docker
# Expo logs: terminal running expo start
# Browser: F12 → Console
```

---

## 6. Issues encountered & fixes

### 6.1 `create-expo-app` extremely slow

- **Symptom:** Appeared stuck for hours
- **Fix:** Manual scaffold + per-folder `npm install`

### 6.2 Docker: `dockerDesktopLinuxEngine` pipe not found

- **Symptom:** `open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified`
- **Cause:** Docker Desktop not running or not installed
- **Fix:** Start Docker Desktop, or use `npm run dev` in `backend/` instead

### 6.3 Web: 500 + MIME type `application/json` on bundles

- **Symptom:** Browser refused to execute `_error.bundle`; Metro bundling failed
- **Cause:** `nativewind/babel` → `react-native-css-interop/babel` includes `react-native-worklets/plugin` (Reanimated 4 / RN 0.81+), but project uses **Reanimated 3** on Expo 52
- **Fix:** Updated `mobile/babel.config.js` to use `react-native-css-interop/dist/babel-plugin` only + `react-native-reanimated/plugin`; set `reanimated: false` on `babel-preset-expo` to avoid duplicate plugins
- **Verify:** `npx expo export --platform web` succeeded (routes bundled)

### 6.4 Haptics crash on web

- **Symptom:** `Haptics.notificationAsync` / `impactAsync` not available on web
- **Cause:** `expo-haptics` is native-only
- **Fix:** Added `mobile/src/lib/haptics.ts` — no-ops on web, works on iOS/Android; updated all components/screens
- **Note:** Fix is in **mobile/** only; **no Docker rebuild** needed

### 6.5 Expo package version warnings

- `@expo/vector-icons`, `react-native` slightly off expected versions — non-blocking for demo

---

## 7. Key concepts clarified in chat

### Why cart/haptics errors disappeared without rebuilding Docker

- Docker = **backend API only**
- Cart UI and haptics = **Expo on your PC** (`mobile/`)
- Fixes were in `mobile/`; Expo hot reload / restart picked them up
- Docker image unchanged and still fine for API

### Why Docker only packages the backend

- **By design** in `docker-compose.yml` (one `api` service)
- Backend = long-running HTTP server → ideal for containers
- Expo = Metro bundler, web/iOS/Android targets, Expo Go — normally run locally for dev
- Could add a **production web** Docker image later (static export + nginx); not required for internship demo

### Does Docker have the latest changes?

- **Backend changes:** Need `docker compose up --build -d`
- **Mobile changes:** Restart Expo only; Docker irrelevant
- **`.env` / API key:** `docker compose down` && `docker compose up -d` (rebuild optional)

---

## 8. Demo script (Loom ~5 min)

1. Show API health: `http://localhost:3001/health`
2. **Menu** — categories, add to cart
3. **AI** — *"Add two spicy chicken sandwiches and a large water"* → cart updates
4. **Cart** — quantity, subtotal/tax
5. Code tour: `ruleBasedParser.ts`, `aiService.ts`, `cartStore.ts`, `assistant.tsx`
6. Mention: Cursor, optional OpenAI key, Docker for API, Expo for UI

---

## 9. Submission checklist

- [ ] Push to GitHub (clean repo, README)
- [ ] Record Loom walkthrough
- [ ] Email Viridien: **GitHub URL + Loom URL**
- [ ] Optional: add `OPENAI_API_KEY` for live LLM demo (`ai: openai` on `/health`)

---

## 10. Useful commands cheat sheet

```powershell
# Health
Invoke-RestMethod http://localhost:3001/health

# Test chat
$body = '{"message":"Add two spicy chicken sandwiches and a large water"}'
Invoke-RestMethod -Uri http://localhost:3001/api/chat -Method POST -Body $body -ContentType "application/json"

# Docker rebuild
docker compose down
docker compose up --build -d
docker compose logs -f api

# Mobile web
cd mobile
npx expo start --web --clear
```

---

## 11. Files touched in later fixes (after initial scaffold)

| File | Change |
|------|--------|
| `mobile/babel.config.js` | Remove `nativewind/babel` worklets plugin conflict |
| `mobile/src/lib/haptics.ts` | Platform-safe haptics wrapper |
| `mobile/components/*.tsx` | Use haptics wrapper |
| `mobile/app/(tabs)/*.tsx` | Use haptics wrapper |
| `backend/Dockerfile` | Production API image |
| `docker-compose.yml` | Compose service definition |
| `README.md` | Full architecture + setup guide |

---

## 12. Open / optional next steps

- Replace placeholder app icons in `mobile/assets/`
- Pin Expo dependency versions with `npx expo install --fix`
- Add production web Docker service (optional)
- `git push` + Loom recording

---

*Generated from project working sessions. Update this file if you make major architectural or setup changes.*
