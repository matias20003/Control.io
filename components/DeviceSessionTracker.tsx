"use client";

import { useEffect } from "react";

export function DeviceSessionTracker() {
  useEffect(() => {
    void fetch("/api/device-sessions", { method: "GET", cache: "no-store" });
  }, []);
  return null;
}
