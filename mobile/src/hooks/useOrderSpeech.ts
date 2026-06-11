/**
 * Metro resolves `useOrderSpeech` to:
 * - useOrderSpeech.web.ts on web
 * - useOrderSpeech.native.ts on iOS/Android
 */
export type { UseOrderSpeechOptions, UseOrderSpeechResult } from "./useOrderSpeech.types";
export { useOrderSpeech } from "./useOrderSpeech.native";
