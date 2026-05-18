/**
 * Metro resolves `useVoiceInput` to:
 * - useVoiceInput.web.ts on web
 * - useVoiceInput.native.ts on iOS/Android
 *
 * This file exists for TypeScript and as a fallback export.
 */
export type { UseVoiceInputOptions, UseVoiceInputResult } from "./useVoiceInput.types";
export { useVoiceInput } from "./useVoiceInput.native";
