/**
 * TypeScript entry point. Metro loads `useVoiceInput.native.ts` on iOS/Android
 * and `useVoiceInput.web.ts` on web — neither imports expo-speech-recognition in Expo Go.
 */
export type { UseVoiceInputOptions, UseVoiceInputResult } from "./useVoiceInput.types";
export { useVoiceInput } from "./useVoiceInput.web";
