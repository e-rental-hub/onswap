"use client";

import { useEffect } from "react";

export default function PiInit() {
  useEffect(() => {
    const init = async () => {
      if (typeof window !== "undefined" && window.Pi) {
        await window.Pi.init({
          version: "2.0",
          sandbox: process.env.NODE_ENV === "development",
        });
      }
    };
    init();
  }, []);

  return null;
}
