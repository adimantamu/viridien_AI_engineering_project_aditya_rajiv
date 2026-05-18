# Session Notes — 15 May 2026

**Project:** The Intelligent Bistro (`viridien_project_intelligent_bistro`)  
**Focus:** Smarter AI ordering, voice input (Microsoft Edge), and robust quantity parsing  
**Previous notes:** [SESSION_NOTES.md](./SESSION_NOTES.md) (project inception and earlier troubleshooting)

---

## 1. Session goals (user requests)

1. **Cancel via AI** — Actually cancel orders, not only list line items.
2. **Place order via AI** — Show full cart summary → user says **yes** → place order; **no** → keep editing.
3. **Smarter suggestions** — ≥4 dishes per category; pairing ideas after starters; detect **missing cart categories**.
4. **Large quantity confirmation** — e.g. add burgers/cakes immediately, confirm 40× sparkling water separately.
5. **Warm greeting** on first open of AI tab (3–4 featured dishes).
6. **Category suggestions** — “Suggestions for bowls” must list **Bowls**, not generic mains.
7. **Voice (mic)** — Work reliably in **Microsoft Edge** on desktop; fix stop → start again.
8. **Quantity parsing** — Word numbers, `3 in quantity`, `of quantity 6`, `add.4`, multi-item voice sentences.
9. **No phantom items** — e.g. do not add spicy chicken sandwich when user did not ask for it.
10. **Compound orders** — Menu question + add in one message must both work.
11. **“Kitchen” error** — Fix misleading failure when rules parser failed before OpenAI.

---

## 2. Architecture added / updated

### Backend — structured chat (rules-first)

| File | Role |
|------|------|
| `backend/src/services/chatOrchestrator.ts` | Confirmations (`place_order`, `bulk_add`), cancel, place order, cart add, compound messages |
| `backend/src/services/mealSuggestions.ts` | Category detection (scored), combo pairings, meal-gap advice |
| `backend/src/services/menuInquiry.ts` | Menu Q&A; delegates category + smart recommendations |
| `backend/src/services/messageNormalizer.ts` | Voice/text cleanup, `extractAddText`, `extractMenuInquiryText` |
| `backend/src/services/orderSegmentParser.ts` | Segments, quantities, `matchMenuItem`, `parseAddActionsFromMessage` |
| `backend/src/services/orderParser.ts` | Cancel / order detail (excludes cancel from “show order”) |
| `backend/src/services/aiService.ts` | OpenAI + rules; cart context with missing categories |
| `backend/src/data/menu.ts` | Expanded to **4+ items per category**; extra aliases |

### Mobile — session + voice

| File | Role |
|------|------|
| `mobile/app/(tabs)/assistant.tsx` | `sessionContext`, `placeOrderFromCart`, greeting on mount, Edge subtitle |
| `mobile/src/lib/webSpeechRecognition.ts` | Edge/Chrome speech, stop chain, reconnect, secure-context checks |
| `mobile/src/hooks/useVoiceInput.web.ts` | Async stop/start, `reconnecting` state |
| `mobile/src/types/index.ts` | `ChatSessionContext`, `placeOrderFromCart` |

### API contract

- **Request:** optional `session: { awaitingConfirmation, pendingActions }`
- **Response:** `sessionContext`, `placeOrderFromCart?: boolean`

---

## 3. AI behavior (rules path)

### Order lifecycle

| User says | Behavior |
|-----------|----------|
| Cancel my last order | `CANCEL_ORDER` → Orders tab updated |
| Place order | Cart summary → **yes** places via `placeOrderFromCart` |
| Yes / No | Respects `place_order` or `bulk_add` session |
| Add with qty > 10 | Immediate adds for normal items; large qty → confirm |

### Suggestions

- **Category:** “suggestions for bowls” → only Bowls (scored inquiry clause, not “sandwich” in same sentence).
- **Combo / gaps:** After add, suggests pairings; flags missing drink/side/dessert.
- **Greeting:** `hello` on empty history → featured dishes from backend.

### High-quantity threshold

- `HIGH_QUANTITY_THRESHOLD = 10` in `chatOrchestrator.ts`

---

## 4. Voice input (web / Microsoft Edge)

### Requirements

- **Desktop Edge or Chrome** on `http://localhost:8081` (not `http://172.x.x.x` — mic blocked on LAN IP).
- Allow microphone in site permissions (lock icon in address bar).

### Fixes

- Serialized **stop → 1.4s gap → start** (`stopChain` + `SpeechSessionGate`).
- No split on ` also ` inside **“and also”** (avoid stray `and` segment).
- Silent **reconnect** on `network` errors (UI: “Still listening — reconnecting…”).
- `getWebSpeechSupport()` explains Edge + localhost vs LAN IP.

### Known limitation

- **Expo Go on phone:** no native voice module; type or use **web on PC**.

---

## 5. Quantity & parsing fixes (critical bugs)

### Segment splitting

- Removed `\s+with\s+` split (broke **“along with”**).
- Normalize: `and also`, `along with that`, `added to cart`, `add.4` → `add 4`.
- Filter stopwords: `and`, `along`, `that`, etc.
- Strip leading `add` per segment.

### Quantities

- Leading: `3 burgers`, `seven sandwiches`
- Trailing: `bruschetta 3 in quantity`, `of quantity 6`
- Word numbers: one–twenty, thirty, forty, fifty, dozen, etc.

### False item matches (fixed)

| Bug | Cause | Fix |
|-----|--------|-----|
| Spicy chicken from “and” | `sandwich` contains substring `and` | Stopwords + min length for fuzzy match |
| Wrong category (bowls → mains) | `options…sandwiches` greedy match | Score category on **inquiry clause only**; remove sandwich/burger as category aliases |
| Only lemonade in compound order | `extractAddText` took text after last `add` only | Full normalized message for pure add orders |
| Salmon qty 1 instead of 11 | Segment `add 11 salmon…` | Strip `add` before `extractQuantity`; word-boundary menu match |
| “Kitchen” error | Rules returned null → OpenAI failed | `messageHasAddIntent` → try `handleCartAdd` first; better fallback message |

### Menu aliases added (examples)

- `choco lava cake`, `grilled atlantic sandwiches` → salmon (voice slip)
- `burger`, `burgers` on truffle burger

---

## 6. Example utterances (verified in rules tests)

```
Add 3 truffle parmesan fries and tomato bruschetta of quantity 6
→ 3× fries, 6× bruschetta (no phantom sandwich)

add tomato bruschetta 3 in quantity and 4 crispy calamari
→ 3× bruschetta, 4× calamari

In the cart add 4 truffle mushroom burgers and seven spicy chicken sandwiches and four choco lava cakes
→ 4× burger, 7× sandwich, 4× lava cake

4 craft lavender lemonade … and also add 11 grilled atlantic sandwiches
→ 4× lemonade now; 11× salmon after yes (bulk confirm)

give me some suggestions for bowls
→ Lists all Bowls only
```

---

## 7. How to run after these changes

```powershell
# Backend (pick up menu + parser + chat changes)
docker compose up --build -d
Invoke-RestMethod http://localhost:3001/health

# Mobile
cd mobile
npx expo start --clear
# Web: http://localhost:8081 in Edge
```

**`.env`:** `backend/.env` with `OPENAI_API_KEY` (optional). If missing, rules path handles most ordering; OpenAI adds polish when API is up.

---

## 8. Files touched this session (summary)

**Backend:** `chatOrchestrator.ts`, `mealSuggestions.ts`, `menuInquiry.ts`, `messageNormalizer.ts`, `orderSegmentParser.ts`, `orderParser.ts`, `aiService.ts`, `menu.ts`, `types/index.ts`, `routes/chat.ts`

**Mobile:** `assistant.tsx`, `webSpeechRecognition.ts`, `useVoiceInput.web.ts`, `useVoiceInput.types.ts`, `api.ts`, `types/index.ts`, `icons.ts`

---

## 9. Open items / follow-ups

- [ ] Re-test mic in Edge after `docker compose up --build` + hard refresh
- [ ] Loom demo: cancel, place order with yes, category suggestions, voice one-shot + stop/start
- [ ] Optional: reduce pairing text verbosity when multiple items added at once
- [ ] Phone: document “type in AI tab” or custom dev build for native voice

---

*Session date: 15 May 2026. Append to [SESSION_NOTES.md](./SESSION_NOTES.md) index if you add more dated notes.*
