"use client";

import Image from "next/image";
import { PiAuthButton } from "@/components/PiAuthButton";

interface SplashScreenProps {
  onAuthSuccess: (token: string, uid: string, username: string) => void;
  showToast: (msg: string) => void;
}

export default function SplashScreen({ onAuthSuccess, showToast }: SplashScreenProps) {
  return (
    <div className="splash">
      {/* Animated background rings */}
      <div className="splash-rings">
        <div className="ring ring-1"/>
        <div className="ring ring-2"/>
        <div className="ring ring-3"/>
      </div>

      {/* Logo */}
      <div className="splash-logo-wrap">
        <Image
          src="/token-logo.png"
          alt="MapCap token"
          width={120}
          height={120}
          className="splash-logo"
          priority
        />
      </div>

      {/* Title block */}
      <div className="splash-titles">
        <h1 className="splash-title">MapCap IPO</h1>
        <p className="splash-subtitle">Pi Network · Community Investment</p>
      </div>

      {/* Tagline */}
      <p className="splash-tagline">
        Invest your π in the Map&nbsp;of&nbsp;Pi equity IPO.<br/>
        Fair price. No whale race. Vested rewards.
      </p>

      {/* Stats preview pills */}
      <div className="splash-pills">
        <div className="splash-pill">
          <span className="pill-value">2,181,818</span>
          <span className="pill-label">MapCap tokens</span>
        </div>
        <div className="splash-pill">
          <span className="pill-value">28 days</span>
          <span className="pill-label">IPO window</span>
        </div>
        <div className="splash-pill">
          <span className="pill-value">+20%</span>
          <span className="pill-label">LP open bonus</span>
        </div>
      </div>

      {/* Auth CTA */}
      <div className="splash-cta">
        <PiAuthButton
          onAuthSuccess={onAuthSuccess}
          showToast={showToast}
          className="splash-auth-btn"
        >
          <span className="splash-btn-pi">π</span>
          Connect Pi Wallet
        </PiAuthButton>
        <p className="splash-hint">
          Authenticated securely via Pi Network SDK
        </p>
      </div>

      {/* Version */}
      <p className="splash-version">MapCapIPO v1.0 · Map of Pi Team</p>
    </div>
  );
}
