// Pure Web Audio API Synthesizer for Apple-style high fidelity chimes
// Re-exports and integrates with unified synthesizer

import {
  playTargetChime,
  playStopLossAlert,
  playEntryTriggered,
  playTimeStopWarning,
} from "./sounds";

export {
  playTargetChime,
  playStopLossAlert,
  playEntryTriggered,
  playTimeStopWarning,
  setMuted,
  isMuted,
  setVolume,
  getVolume,
  unlockAudio,
  setupAudioUnlockListeners,
} from "./sounds";

export function playAudioChime(type: "CLICK" | "PROMOTION" | "ALERT" | "TARGET" | "WARNING" | string = "CLICK"): void {
  try {
    if (type === "PROMOTION" || type === "TARGET") {
      playTargetChime();
    } else if (type === "ALERT") {
      playStopLossAlert();
    } else if (type === "WARNING") {
      playTimeStopWarning();
    } else {
      playEntryTriggered();
    }
  } catch {
    // Audio optional in test/headless environments
  }
}
