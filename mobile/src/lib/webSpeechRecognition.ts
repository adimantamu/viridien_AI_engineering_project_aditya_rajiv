/** Browser Web Speech API — Chrome / Edge on localhost or HTTPS. */

export type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string; message?: string }) => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
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

/** Edge/Chrome need a quiet gap between SpeechRecognition sessions. */
const MIN_GAP_BETWEEN_SESSIONS_MS = 1400;
const RESTART_AFTER_END_MS = 400;
const MAX_NETWORK_RETRIES = 4;
const MAX_INVALID_STATE_RETRIES = 3;
const STOP_SETTLE_MS = 200;

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

export type WebBrowserKind = "edge" | "chrome" | "firefox" | "safari" | "other";

export interface WebSpeechSupport {
  available: boolean;
  browser: WebBrowserKind;
  isMobile: boolean;
  isSecureContext: boolean;
  unavailableReason?: string;
  hint?: string;
}

export function detectBrowser(): WebBrowserKind {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return "edge";
  if (/Chrome\//.test(ua)) return "chrome";
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return "safari";
  return "other";
}

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

/** Full check — Edge/Chrome desktop on localhost or HTTPS. */
export function getWebSpeechSupport(): WebSpeechSupport {
  const browser = detectBrowser();
  const isMobile = isMobileDevice();
  const isSecureContext =
    typeof window !== "undefined" && typeof window.isSecureContext === "boolean"
      ? window.isSecureContext
      : true;

  const hasCtor = getBrowserSpeechRecognitionCtor() !== null;

  if (isMobile) {
    return {
      available: false,
      browser,
      isMobile,
      isSecureContext,
      unavailableReason:
        "Voice in the browser works on desktop Microsoft Edge or Chrome.",
      hint: "On your phone, type your order below.",
    };
  }

  if (!isSecureContext) {
    const host =
      typeof window !== "undefined" ? window.location.hostname : "";
    const isLanIp = /^\d+\.\d+\.\d+\.\d+$/.test(host);
    return {
      available: false,
      browser,
      isMobile,
      isSecureContext,
      unavailableReason: isLanIp
        ? "Microsoft Edge blocks the microphone on network IP pages (http://172.x…)."
        : "Voice needs a secure page (HTTPS or localhost).",
      hint: isLanIp
        ? "On this PC, open http://localhost:8081 in Edge — use that URL, not the 172.x address."
        : "Open the app at http://localhost:8081",
    };
  }

  if (!hasCtor) {
    if (browser === "firefox") {
      return {
        available: false,
        browser,
        isMobile,
        isSecureContext,
        unavailableReason: "Firefox does not support web speech recognition.",
        hint: "Use Microsoft Edge or Google Chrome on desktop.",
      };
    }
    return {
      available: false,
      browser,
      isMobile,
      isSecureContext,
      unavailableReason: "This browser does not support voice recognition.",
      hint: "Use Microsoft Edge or Google Chrome on desktop.",
    };
  }

  return {
    available: true,
    browser,
    isMobile,
    isSecureContext,
    hint:
      browser === "edge"
        ? "Voice enabled — Microsoft Edge on desktop."
        : undefined,
  };
}

export function isBrowserSpeechRecognitionAvailable(): boolean {
  return getWebSpeechSupport().available;
}

export function transcriptFromBrowserResultEvent(event: BrowserSpeechRecognitionEvent): string {
  let finalText = "";
  let interimText = "";

  for (let i = 0; i < event.results.length; i++) {
    const result = event.results[i];
    const chunk = result?.[0]?.transcript;
    if (!chunk) continue;
    if (result.isFinal) {
      finalText += chunk;
    } else {
      interimText += chunk;
    }
  }

  return (finalText + interimText).trim();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Serializes mic start/stop so Chrome never gets overlapping sessions. */
class SpeechSessionGate {
  private static chain: Promise<void> = Promise.resolve();
  private static lastReleasedAt = 0;

  static async waitForSlot(): Promise<void> {
    const ticket = SpeechSessionGate.chain.then(async () => {
      const elapsed = Date.now() - SpeechSessionGate.lastReleasedAt;
      if (elapsed < MIN_GAP_BETWEEN_SESSIONS_MS) {
        await delay(MIN_GAP_BETWEEN_SESSIONS_MS - elapsed);
      }
    });
    SpeechSessionGate.chain = ticket.catch(() => undefined);
    await ticket;
  }

  static markReleased(): void {
    SpeechSessionGate.lastReleasedAt = Date.now();
  }

  static async waitUntilReady(): Promise<void> {
    await SpeechSessionGate.waitForSlot();
  }
}

let micPermissionPrimed = false;

async function ensureMicPermission(): Promise<boolean> {
  if (micPermissionPrimed) return true;
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    micPermissionPrimed = true;
    return true;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) {
      track.stop();
    }
    micPermissionPrimed = true;
    return true;
  } catch {
    return false;
  }
}

function micBlockedMessage(): string {
  if (detectBrowser() === "edge") {
    return "Microphone blocked in Edge. Click the lock icon in the address bar → Permissions for this site → Allow Microphone.";
  }
  return "Microphone blocked. Click the lock icon in the address bar and allow the microphone.";
}

function mapSpeechError(error: string, message?: string): string {
  switch (error) {
    case "not-allowed":
      return micBlockedMessage();
    case "network":
      return "Voice service unavailable. Tap the mic to try again.";
    case "service-not-allowed":
      return "Speech recognition is disabled in this browser. In Edge: Settings → Privacy → Site permissions → Microphone.";
    case "audio-capture":
      return "No microphone found. Check your mic is connected.";
    default:
      return message || `Voice error: ${error}`;
  }
}

export type WebSpeechState = "idle" | "preparing" | "listening" | "reconnecting" | "error";

export interface WebSpeechSessionCallbacks {
  onTranscript: (text: string) => void;
  onState: (state: WebSpeechState, message?: string) => void;
}

/**
 * One listening period per user tap. Chrome requires a fresh SpeechRecognition
 * instance after each end(); we auto-restart on silence until the user stops.
 */
export class WebSpeechSession {
  private static stopChain: Promise<void> = Promise.resolve();

  private recognition: BrowserSpeechRecognition | null = null;
  private active = false;
  private stoppedByUser = false;
  private sessionId = 0;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private networkRetries = 0;
  private endHandled = true;

  constructor(private readonly callbacks: WebSpeechSessionCallbacks) {}

  private static chainAfterStop(task: () => Promise<void>): Promise<void> {
    const next = WebSpeechSession.stopChain.then(task, task);
    WebSpeechSession.stopChain = next.catch(() => undefined);
    return next;
  }

  get isActive(): boolean {
    return this.active;
  }

  async start(): Promise<void> {
    await WebSpeechSession.stopChain;
    await SpeechSessionGate.waitUntilReady();

    const support = getWebSpeechSupport();
    if (!support.available) {
      const msg = [support.unavailableReason, support.hint].filter(Boolean).join(" ");
      this.callbacks.onState("error", msg || "Voice is not available in this browser.");
      return;
    }

    const Ctor = getBrowserSpeechRecognitionCtor();
    if (!Ctor) {
      this.callbacks.onState(
        "error",
        "Use Microsoft Edge or Chrome on desktop for voice input.",
      );
      return;
    }

    this.sessionId += 1;
    const id = this.sessionId;
    this.stoppedByUser = false;
    this.active = true;
    this.networkRetries = 0;
    this.callbacks.onState("preparing");

    const permitted = await ensureMicPermission();
    if (id !== this.sessionId || !this.active) return;

    if (!permitted) {
      this.active = false;
      this.callbacks.onState("error", micBlockedMessage());
      return;
    }

    await this.beginRecognitionCycle(id);
  }

  stop(): Promise<void> {
    this.stoppedByUser = true;
    this.active = false;
    this.sessionId += 1;
    this.clearRestartTimer();
    this.callbacks.onState("idle");

    return WebSpeechSession.chainAfterStop(async () => {
      this.teardownRecognition();
      await delay(MIN_GAP_BETWEEN_SESSIONS_MS);
    });
  }

  private async beginRecognitionCycle(id: number): Promise<void> {
    if (id !== this.sessionId || !this.active || this.stoppedByUser) {
      return;
    }

    await SpeechSessionGate.waitForSlot();
    if (id !== this.sessionId || !this.active || this.stoppedByUser) {
      return;
    }

    await delay(STOP_SETTLE_MS);
    if (id !== this.sessionId || !this.active || this.stoppedByUser) {
      return;
    }

    this.attachAndStart(id);
  }

  private attachAndStart(id: number): void {
    if (id !== this.sessionId || !this.active || this.stoppedByUser) {
      return;
    }

    const Ctor = getBrowserSpeechRecognitionCtor();
    if (!Ctor) {
      this.active = false;
      this.callbacks.onState("error", "Speech recognition is not available.");
      return;
    }

    const recognition = new Ctor();
    this.recognition = recognition;
    this.endHandled = false;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      if (id !== this.sessionId) return;
      this.networkRetries = 0;
      this.callbacks.onState("listening");
    };

    recognition.onspeechstart = () => {
      if (id !== this.sessionId) return;
      this.callbacks.onState("listening");
    };

    recognition.onresult = (event) => {
      if (id !== this.sessionId) return;
      const text = transcriptFromBrowserResultEvent(event);
      if (text) {
        this.callbacks.onTranscript(text);
      }
    };

    recognition.onerror = (event) => {
      if (id !== this.sessionId) return;

      if (event.error === "aborted" || event.error === "no-speech") {
        return;
      }

      if (event.error === "network" && this.active && !this.stoppedByUser) {
        this.scheduleRecovery(id, "network");
        return;
      }

      this.active = false;
      this.callbacks.onState("error", mapSpeechError(event.error, event.message));
      this.teardownRecognition();
    };

    recognition.onend = () => {
      if (id !== this.sessionId || this.endHandled) return;
      this.endHandled = true;
      SpeechSessionGate.markReleased();

      const rec = this.recognition;
      this.recognition = null;
      if (rec) {
        rec.onstart = null;
        rec.onend = null;
        rec.onerror = null;
        rec.onresult = null;
        rec.onspeechstart = null;
      }

      if (this.stoppedByUser || !this.active) {
        this.callbacks.onState("idle");
        return;
      }

      this.clearRestartTimer();
      this.restartTimer = setTimeout(() => {
        this.restartTimer = null;
        if (id !== this.sessionId || !this.active || this.stoppedByUser) {
          return;
        }
        void this.beginRecognitionCycle(id);
      }, RESTART_AFTER_END_MS);
    };

    void this.tryStart(recognition, id);
  }

  private scheduleRecovery(id: number, reason: "network" | "invalid-state"): void {
    if (id !== this.sessionId || !this.active || this.stoppedByUser) {
      return;
    }

    const maxRetries = reason === "network" ? MAX_NETWORK_RETRIES : MAX_INVALID_STATE_RETRIES;
    if (this.networkRetries >= maxRetries) {
      this.active = false;
      this.callbacks.onState(
        "error",
        reason === "network"
          ? "Voice service unavailable. Tap the mic to try again."
          : "Could not start the microphone. Tap the mic to try again.",
      );
      this.teardownRecognition();
      return;
    }

    this.networkRetries += 1;
    this.callbacks.onState("reconnecting");
    this.teardownRecognition();

    const backoff = 500 + this.networkRetries * 250;
    this.clearRestartTimer();
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      if (id !== this.sessionId || !this.active || this.stoppedByUser) {
        return;
      }
      void this.beginRecognitionCycle(id);
    }, backoff);
  }

  private async tryStart(
    recognition: BrowserSpeechRecognition,
    id: number,
    attempt = 0,
  ): Promise<void> {
    if (id !== this.sessionId || !this.active || this.stoppedByUser) {
      return;
    }

    try {
      recognition.start();
    } catch (error) {
      const isInvalidState =
        error instanceof DOMException && error.name === "InvalidStateError";

      if (isInvalidState && attempt < MAX_INVALID_STATE_RETRIES) {
        await delay(300 * (attempt + 1));
        if (id !== this.sessionId || !this.active || this.stoppedByUser) {
          return;
        }
        return this.tryStart(recognition, id, attempt + 1);
      }

      if (isInvalidState) {
        this.scheduleRecovery(id, "invalid-state");
        return;
      }

      this.active = false;
      this.callbacks.onState(
        "error",
        "Could not start the microphone. Tap the mic to try again.",
      );
      this.teardownRecognition();
    }
  }

  private clearRestartTimer(): void {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
  }

  private teardownRecognition(): void {
    this.clearRestartTimer();
    const rec = this.recognition;
    this.recognition = null;
    if (!rec) {
      SpeechSessionGate.markReleased();
      return;
    }

    this.endHandled = true;
    SpeechSessionGate.markReleased();

    rec.onstart = null;
    rec.onend = null;
    rec.onerror = null;
    rec.onresult = null;
    rec.onspeechstart = null;

    try {
      rec.abort();
    } catch {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }
  }
}
