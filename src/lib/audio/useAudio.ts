"use client";

import { useState, useCallback, useEffect } from "react";
import {
  playTargetChime,
  playStopLossAlert,
  playEntryTriggered,
  playTimeStopWarning,
  setMuted,
  isMuted as getMutedState,
  setVolume as setGlobalVolume,
  getVolume as getGlobalVolume,
  unlockAudio,
} from "./sounds";

export function useAudio() {
  const [isMuted, setIsMutedState] = useState<boolean>(false);
  const [volume, setVolumeState] = useState<number>(0.7);

  useEffect(() => {
    setIsMutedState(getMutedState());
    setVolumeState(getGlobalVolume());
  }, []);

  const toggleMute = useCallback(() => {
    setIsMutedState((prev) => {
      const next = !prev;
      setMuted(next);
      return next;
    });
  }, []);

  const updateVolume = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    setGlobalVolume(clamped);
    setVolumeState(clamped);
  }, []);

  return {
    isMuted,
    volume,
    toggleMute,
    setVolume: updateVolume,
    playTarget: playTargetChime,
    playStop: playStopLossAlert,
    playEntry: playEntryTriggered,
    playTimeStop: playTimeStopWarning,
    unlockAudio,
  };
}

export default useAudio;
