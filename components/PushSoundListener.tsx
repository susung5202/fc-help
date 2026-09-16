"use client";

import { useEffect } from "react";
import { getStoredAlertVolume, playAlertSound } from "@/lib/ui/alertSound";

export default function PushSoundListener() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    function handleMessage(event: MessageEvent) {
      if (event.data?.type !== "FC_HELP_PUSH_SOUND") return;
      void playAlertSound(getStoredAlertVolume());
    }

    navigator.serviceWorker.addEventListener("message", handleMessage);

    return () => {
      navigator.serviceWorker.removeEventListener("message", handleMessage);
    };
  }, []);

  return null;
}
