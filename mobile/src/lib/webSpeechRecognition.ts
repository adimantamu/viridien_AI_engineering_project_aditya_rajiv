/** Browser Web Speech API helpers (Chrome / Edge on localhost or HTTPS). */

export type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string; message?: string }) => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onaudiostart?: (() => void) | null;
  onspeechstart?: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

export type BrowserSpeechRecognitionEvent = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      length: number;
      [altIndex: number]: { transcript: string; confidence: number };
    };
  };
};

let primed = false;
let primePromise: Promise<boolean> | null = null;

export function getBrowserSpeechRecognitionCtor():
  | (new () => BrowserSpeechRecognition)
  | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isBrowserSpeechRecognitionAvailable(): boolean {
  return getBrowserSpeechRecognitionCtor() !== null;
}

export function transcriptFromBrowserResultEvent(event: BrowserSpeechRecognitionEvent): string {
  let transcript = "";
  for (let i = 0; i < event.results.length; i++) {
    const chunk = event.results[i]?.[0]?.transcript;
    if (chunk) transcript += chunk;
  }
  return transcript.trim();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** One-time mic permission + hardware wake-up so the first tap works reliably. */
export async function primeMicrophonePermission(): Promise<boolean> {
  if (primed) return true;
  if (primePromise) return primePromise;

  primePromise = (async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      stream.getTracks().forEach((track) => track.stop());
      primed = true;
      return true;
    } catch {
      return false;
    } finally {
      primePromise = null;
    }
  })();

  return primePromise;
}

/** Keep a mic stream open for the whole voice session (Chrome works better this way). */
export async function acquireMicrophoneStream(): Promise<MediaStream | null> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return null;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    primed = true;
    return stream;
  } catch {
    return null;
  }
}

export function releaseMicrophoneStream(stream: MediaStream | null): void {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}

export async function startRecognitionWithRetry(
  recognition: BrowserSpeechRecognition,
  maxAttempts = 4,
): Promise<boolean> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      recognition.start();
      return true;
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      const isInvalidState =
        name === "InvalidStateError" ||
        (error instanceof DOMException && error.code === 11);

      if (!isInvalidState || attempt === maxAttempts - 1) {
        throw error;
      }
      await delay(180 * (attempt + 1));
    }
  }
  return false;
}
