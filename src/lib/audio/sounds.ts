import { audioSynthesizer } from "./synthesizer";

export function playTargetChime(): void {
  audioSynthesizer.playTargetChime();
}

export function playStopLossAlert(): void {
  audioSynthesizer.playStopLossAlert();
}

export function playEntryTriggered(): void {
  audioSynthesizer.playEntryTriggered();
}

export function playTimeStopWarning(): void {
  audioSynthesizer.playTimeStopWarning();
}

export function setMuted(muted: boolean): void {
  audioSynthesizer.setMuted(muted);
}

export function isMuted(): boolean {
  return audioSynthesizer.isMuted();
}

export function setVolume(volume: number): void {
  audioSynthesizer.setVolume(volume);
}

export function getVolume(): number {
  return audioSynthesizer.getVolume();
}

export function unlockAudio(): Promise<void> {
  return audioSynthesizer.unlockAudio();
}

export function setupAudioUnlockListeners(): void {
  audioSynthesizer.attachUnlockListeners();
}
