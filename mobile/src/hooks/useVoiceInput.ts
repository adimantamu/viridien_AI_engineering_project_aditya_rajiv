import { Platform } from "react-native";
import type { UseVoiceInputOptions, UseVoiceInputResult } from "./useVoiceInput.types";

export type { UseVoiceInputOptions, UseVoiceInputResult } from "./useVoiceInput.types";

const impl =
  Platform.OS === "web"
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("./useVoiceInput.web")
    : // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("./useVoiceInput.native");

export function useVoiceInput(options: UseVoiceInputOptions): UseVoiceInputResult {
  return impl.useVoiceInput(options);
}
