"use client";

/**
 * PiAuthButton.tsx
 *
 * Handles Pi Network authentication ONLY — no payment.
 * Calls window.Pi.authenticate and surfaces the accessToken + user info
 * to the parent via onAuthSuccess.
 *
 * Separated from PiPayButton so auth state can be established once
 * (e.g. on the splash screen) before any payment is initiated.
 */

import React, { useState, useEffect } from "react";
import { PiAuthResult, PaymentInfo } from "@/types";
import { payment } from "@/lib/api";
import Image from "next/image";

declare global {
  interface Window {
    Pi?: {
      init(opts: { version: string; sandbox?: boolean }): void;
      authenticate(
        scopes: string[],
        onIncompletePaymentFound: (p: PaymentInfo) => void
      ): Promise<PiAuthResult>;
      createPayment(data: unknown, callbacks: unknown): void;
    };
  }
}

export interface PiAuthButtonProps {
  onAuthSuccess: (accessToken: string, uid: string, username: string) => void;
  onError?: (err: Error) => void;
  showToast: (msg: string) => void;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function PiAuthButton({
  onAuthSuccess,
  onError,
  showToast,
  disabled = false,
  className = "",
  children,
}: PiAuthButtonProps) {
  const [sdkReady, setSdkReady] = useState(false);
  const [busy,     setBusy]     = useState(false);

  // Poll until window.Pi is injected by the SDK script
  useEffect(() => {
    let attempts = 0;
    const check = setInterval(() => {
      if (window.Pi) { setSdkReady(true); clearInterval(check); }
      if (++attempts > 50) clearInterval(check);
    }, 100);
    return () => clearInterval(check);
  }, []);

  const handleClick = async () => {
    if (!window.Pi || busy || disabled) return;
    setBusy(true);

    try {
      const auth = await window.Pi.authenticate(
        ["username", "payments", "wallet_address"],
        async (incompletePmt: PaymentInfo) => {
          // Resolve any dangling payment from a previous session
          try {
            await payment.incomplete({paymentInfo: incompletePmt});
          } catch {
            // Non-fatal — log and continue
            console.warn("[Pi] Failed to resolve incomplete payment:", incompletePmt.identifier);
          }
        }
      );

      onAuthSuccess(auth.accessToken, auth.user.uid, auth.user.username);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Authentication failed");
      onError?.(error);
      showToast(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
    <button
      onClick={handleClick}
      disabled={disabled || !sdkReady || busy }
      className="w-full flex items-center justify-center gap-2.5
                 transition-all duration-200 active:scale-[0.98]
                 disabled:opacity-60 disabled:cursor-not-allowed"
      style={{
        padding: "13px 20px", borderRadius: 14,
        background: "linear-gradient(135deg,#143d4d 0%,#1e5f74 100%)",
        color: "white", fontSize: 14, fontWeight: 800,
        boxShadow: "0 4px 18px rgba(30,95,116,0.35)",
        border: "none", cursor: "pointer",
        opacity: !sdkReady || busy ? 0.6 : 1
      }}
    >
      <Image
        src="/pi_logo.png"
        alt="Pi Network"
        width={20}
        height={20}
        className="opacity-90 flex-shrink-0"
      />
      {busy ? "Connecting…" : children ?? "Connect with Pi Network"}
    </button>

    </>
  );
}
