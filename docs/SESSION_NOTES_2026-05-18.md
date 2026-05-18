# Session Notes — 18 May 2026

**Project:** The Intelligent Bistro (`viridien_project_intelligent_bistro`)  
**Focus:** Size modifiers (all dishes), OpenAI-first cart parsing, iOS chat UI fixes, voice on Expo Go, compound-order robustness  
**Previous notes:** [SESSION_NOTES_2026-05-15.md](./SESSION_NOTES_2026-05-15.md) · [SESSION_NOTES.md](./SESSION_NOTES.md)

---

## 1. Session goals (user requests)

1. **Sizes on every dish** — Small / Medium / Large with **price deltas** by category; manual picker on Menu and Cart; AI must add/remove/change size in natural language.
2. **Robust AI for nuanced input** — Compound orders, chained phrasing, size inquiries, multi-category menu browse; **heavy use of OpenAI** when API key is set.
3. **Voice** — Working on **web (Chrome/Edge)** and **Expo Go on iPhone** (record → Whisper).
4. **iOS chat UI** — Menu recommendation cards stretched to full screen, hiding later messages; fix layout on Expo Go.
5. **Cart hallucination bug** — Saying *"Add Craft Lavender Lemonade"* caused confirmation (and cart updates) for **all items already in cart**.
6. **Compound parsing** — *"…seven truffle mushroom burgers **with three** craft lavender lemonade"* must add 7 burgers + 3 lemonades, not 7 lemonades and skip burgers.
7. **Final documentation** — README refresh, session notes, deployment/scalability/future scope.

---

## 2. Features delivered

### 2.1 Size modifiers (backend + mobile)

| Layer | Implementation |
|-------|----------------|
| **Data** | `menuModifiers.ts` — `buildSizeModifier()`, `withStandardSizeModifiers()` applied to all items in `menu.ts` |
| **Pricing** | `computeUnitPrice(item, modifiers)` — base + `priceDelta` per size option |
| **Rules parser** | `sizeParser.ts` — extract/strip size words; `SET_MODIFIER`; size price Q&A |
| **Order parser** | `orderSegmentParser.ts` — size on ADD/REMOVE; `expandWithClauses()` for *with N …* |
| **Mobile UI** | `SizeSelector.tsx`, `MenuItemCard.tsx`, `CartLineItem.tsx`, `cartStore.setLineModifier()` |

**Default:** Medium when size not specified on ADD.

**Example phrases:**

- *"Add two large sparkling waters"*
- *"Remove one small truffle fries"*
- *"Change my burger to large"*
- *"Go large on the water"*
- *"How much is a large caesar salad?"*

### 2.2 OpenAI-first cart parsing

| File | Role |
|------|------|
| `openaiCartActions.ts` | Dedicated GPT pass: message + menu catalog → `CartAction[]` (temperature 0, JSON mode) |
| `chatOrchestrator.ts` | `resolveCartActions()` — OpenAI first, rules fallback |
| `orderSegmentParser.ts` | `reconcileAiCartActions()` — anti-hallucination filter |

**Flow when `OPENAI_API_KEY` is set:**

1. `parseCartActionsWithOpenAI(request)`
2. `reconcileAiCartActions(message, aiActions)` — anchor ADD/REMOVE to rules + message text
3. `buildCartMutationResponse()` — summary, pairing blocks (≤2 items added), bulk confirm

**Rules still run** for menu browse, place order, cancel, confirmations, and offline fallback.

### 2.3 Multi-category menu & recommendations

- `detectMenuCategories()` + `buildMultiCategoryMenuResponse()` — *"starters and bowls"*
- `openaiMenuIntent.ts` + `menuBrowseResolver.ts` — OpenAI category classifier + rules merge
- `recommendationBlocks` in chat — tappable dish rows with **Add** chips
- Compound: menu question + cart add in one turn (`handleCompoundMessage`)

### 2.4 Voice input

| Platform | Path |
|----------|------|
| **Web** | `useVoiceInput.web.ts` + `webSpeechRecognition.ts` — live Web Speech on `localhost:8081` |
| **Expo Go (native)** | `useVoiceInput.native.ts` — `expo-av` record → `POST /api/transcribe` (Whisper) |
| **Shared** | `voiceUi.ts` — status lines, placeholders |

`GET /health` includes `voice: "whisper"` when OpenAI key is set.

### 2.5 Validation scripts

```bash
cd backend
npm run validate:parser   # 19 cases — segments, sizes, with-clauses, reconcile
npm run validate:ai       # 23 cases — structured chat, menu, cart, orders
```

---

## 3. Challenges faced and how we overcame them

### 3.1 iOS chat cards stretching (Expo Go)

**Symptom:** Asking *"What are your starters?"* rendered a huge empty brown card; later messages were pushed off-screen. Recommendation rows sometimes stacked vertically (emoji, giant **Add** bar).

**Causes:**

- `flex-1` on `ScrollView` (NativeWind) made scroll **content** fill viewport height; child bubbles stretched.
- Layout on `Pressable` instead of inner `View` — known React Native iOS issue (row layout collapsed).

**Fixes:**

- `assistant.tsx` — `ScrollView` uses `style={{ flex: 1 }}` + `contentContainerStyle` padding only (no `flexGrow`).
- `ChatBubble.tsx` — `flexGrow: 0`; recommendation blocks in a **separate** card below text.
- `RecommendationBlocks.tsx` — row layout on inner `View`; capped nested `ScrollView` (max height ~240px).

### 3.2 OpenAI re-adding entire cart

**Symptom:** *"Add Craft Lavender Lemonade"* → *"Done — added 1× Harvest Grain Bowl, 1× Cheesecake, 1× Lemonade…"* while cart already held bowl + cake.

**Cause:** Cart lines were sent in the OpenAI prompt; the model treated them as items to ADD again.

**Fixes:**

- Prompt rules: cart context is **read-only**; never re-add unless named in **this** message.
- `reconcileAiCartActions()` — intersect OpenAI ADD/REMOVE with rules parser output for the same message; strip extras.
- `itemMentionedInMessage()` fallback when rules return empty.

### 3.3 Wrong quantities on *"with three …"* clauses

**Symptom:** *"7 burgers with 3 lemonades"* → 7 lemonades, burgers missing.

**Cause:** Rules split on `and` only; trailing segment kept `seven` attached to wrong item phrase.

**Fixes:**

- `expandWithClauses()` — `with three X` → `and add three X` before segmentation.
- OpenAI prompt examples for *with* / *along with* / *plus*.
- Validation case in `validate-order-parser.ts`.

### 3.4 Rules running before OpenAI (under-using LLM)

**Symptom:** User repeatedly asked for OpenAI-heavy parsing; complex orders still hit brittle rules first.

**Fix:** `resolveCartActions()` in `handleCartAdd` calls OpenAI **first** when key is set; rules are fallback + reconcile safety net.

### 3.5 Voice on Expo Go

**Symptom:** No native speech module in Expo Go; web-only hook crashed or no-op on device.

**Fix:** Platform-specific hooks (`.web.ts` / `.native.ts`), Whisper transcribe endpoint, `partial` destructuring fix in `assistant.tsx` to avoid render crash.

### 3.6 TypeScript / cart store

- Removed unused `setItemModifier` from interface (incomplete stub).
- `SET_MODIFIER` in `applyActions()` updates `unitPrice` via `computeUnitPrice`.

---

## 4. Key files touched (18 May)

### Backend

```
backend/src/data/menuModifiers.ts
backend/src/data/menu.ts
backend/src/services/openaiCartActions.ts      # NEW
backend/src/services/openaiMenuIntent.ts
backend/src/services/menuBrowseResolver.ts
backend/src/services/sizeParser.ts
backend/src/services/orderSegmentParser.ts     # expandWithClauses, reconcileAiCartActions
backend/src/services/chatOrchestrator.ts       # async, resolveCartActions, buildCartMutationResponse
backend/src/services/menuInquiry.ts
backend/src/services/aiService.ts
backend/src/services/transcribeService.ts
backend/src/routes/transcribe.ts
backend/scripts/validate-order-parser.ts
backend/scripts/validate-ai.ts
```

### Mobile

```
mobile/components/SizeSelector.tsx
mobile/components/MenuItemCard.tsx
mobile/components/CartLineItem.tsx
mobile/components/ChatBubble.tsx
mobile/components/RecommendationBlocks.tsx
mobile/app/(tabs)/assistant.tsx
mobile/app/(tabs)/cart.tsx
mobile/app/(tabs)/index.tsx
mobile/src/store/cartStore.ts
mobile/src/lib/menuModifiers.ts
mobile/src/hooks/useVoiceInput.native.ts
mobile/src/hooks/useVoiceInput.web.ts
mobile/src/lib/voiceUi.ts
mobile/src/lib/transcribeAudio.ts
```

---

## 5. Testing checklist (demo day)

| Test | Expected |
|------|----------|
| Menu → pick **Large** → Add | Cart line shows Large, price > Small |
| Cart → change size chip | Unit price and subtotal update |
| *"Add four spicy chicken sandwiches and seven truffle mushroom burgers with three craft lavender lemonade"* | 4 + 7 + 3 correct items |
| *"Add Craft Lavender Lemonade"* (cart non-empty) | **Only** lemonade confirmed |
| *"What are your starters?"* on iPhone | Compact card, scrollable list, chat continues below |
| Web mic on `localhost:8081` | Live transcript |
| Expo Go mic | Record → transcribe → send |
| `npm run validate:parser` | 19/19 |
| `npm run validate:ai` | 23/23 |
| `GET /health` | `"ai":"openai"`, `"voice":"whisper"` (with key) |

---

## 6. Deployment next steps

1. **Backend**
   - Deploy API container (Fly.io, Railway, Render, AWS ECS, or Azure Container Apps).
   - Set secrets: `OPENAI_API_KEY`, `OPENAI_MODEL` (recommend `gpt-4o` for demos).
   - Expose HTTPS; configure CORS allowlist for production app origin (replace `origin: true`).
2. **Mobile**
   - `eas build` for TestFlight / Play Internal Testing, or web export for kiosk demo.
   - Set `expo.extra.apiUrlProduction` (or env) to public API URL — not `localhost`.
3. **Smoke test**
   - `/health`, `/api/menu`, `/api/chat` compound order, `/api/transcribe` from device.
4. **Ops**
   - Log aggregation (request id, `parsedBy`, latency).
   - Rate limit `/api/chat` and `/api/transcribe` per IP/API key.

---

## 7. Scalability and production hardening

| Area | Current (MVP) | Scale path |
|------|---------------|------------|
| **State** | Stateless API; cart/orders on client | Redis session store; user accounts + server cart |
| **Menu** | In-memory TS catalog | CMS or DB; cache with CDN |
| **AI** | Sync OpenAI per request | Queue workers; cache menu browse; smaller model for classify, larger for edge cases |
| **Voice** | Whisper per recording | Streaming STT; client-side VAD; size limits on upload |
| **Parsing** | Rules + reconcile + OpenAI | Golden-test suite in CI; shadow-mode compare parsers |
| **Mobile** | Expo Go / dev client | EAS production builds; OTA updates for UI-only |
| **Multi-tenant** | Single bistro | `tenantId` on menu + prompts |

**Horizontal scale:** API is stateless → run N containers behind load balancer; sticky sessions only if server-side chat state is added later.

---

## 8. Future scope

- **Payments** — Stripe / Apple Pay after place-order confirm.
- **Kitchen display** — WebSocket order queue for staff.
- **Personalization** — Dietary filters, favorites, reorder last meal.
- **Rich modifiers** — Toppings, allergies, special instructions field.
- **Analytics** — Popular pairings, failed parse rates, voice vs text mix.
- **i18n** — Multi-language menu + prompts.
- **Offline mode** — Rules-only bundle when API unreachable; sync cart on reconnect.
- **RAG menu** — Embeddings for fuzzy item match when menu grows beyond ~100 items.

---

## 9. Conversation arc (today)

1. Polish demo: AI ordering, cart, orders, voice, recommendations before submission.
2. Voice fixes (web Chrome + Expo Go iPhone).
3. Robust AI for menu/cart/compound requests.
4. **Size feature** — all dishes, pricing, manual UI, AI nuances.
5. **iOS UI bug** — oversized starter/recommendation cards.
6. **Compound order failure** — lavender lemonade quantity + OpenAI emphasis.
7. **Cart hallucination** — re-adding all cart lines on single add.
8. **Documentation** — README + this session note.

---

## 10. Quick commands reference

```powershell
# API (Docker)
docker compose up --build -d

# API (local dev)
cd backend
npm run dev

# Validation
npm run validate:parser
npm run validate:ai

# Mobile
cd mobile
npx expo start --clear
```

**Phone API URL:** `mobile/app.json` → `expo.extra.apiUrlDevice` = PC Wi‑Fi IPv4 (not VirtualBox adapter).

---

*End of session notes — 18 May 2026.*
