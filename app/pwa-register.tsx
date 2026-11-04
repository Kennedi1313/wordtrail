"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("Wordtrail: falha ao registrar o service worker", error);
      });
    }
  }, []);

  return null;
}
