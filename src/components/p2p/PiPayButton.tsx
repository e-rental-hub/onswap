'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { PaymentInfo, PiPaymentData } from '@/types';
import { walletApi } from '@/lib/api';
import { logger }    from '@/lib/logger';

declare global {
  interface Window {
    Pi?: {
      init(opts: { version: string; sandbox?: boolean }): void;
      authenticate(
        scopes: string[],
        onIncompletePaymentFound: (p: PaymentInfo) => void
      ): Promise<{ accessToken: string; user: { uid: string; username: string } }>;
      createPayment(data: unknown, callbacks: unknown): void;
    };
  }
}

export interface PiPayButtonProps {
  paymentData:        PiPaymentData;
  accessToken:        string | null;
  onPaymentComplete?: () => void;
  onError?:           (err: Error) => void;
  showToast:          (msg: string) => void;
  disabled?:          boolean;
  className?:         string;
  children?:          React.ReactNode;
}

export function PiPayButton({
  paymentData,
  accessToken,
  onPaymentComplete,
  onError,
  showToast,
  disabled  = false,
  className = '',
  children,
}: PiPayButtonProps) {
  const [sdkReady, setSdkReady] = useState(false);
  const [busy,     setBusy]     = useState(false);

  useEffect(() => {
    let attempts = 0;
    const check = setInterval(() => {
      if (window.Pi) { setSdkReady(true); clearInterval(check); }
      if (++attempts > 50) clearInterval(check);
    }, 100);
    return () => clearInterval(check);
  }, []);

  const handleApproval = useCallback(async (paymentId: string) => {
    try {
      await walletApi.approveDeposit(paymentId);
      logger.info(`[PiPay] Payment approved: ${paymentId}`);
    } catch (err) {
      logger.error('[PiPay] approve error:', err);
      showToast('Payment approval failed');
    }
  }, [showToast]);

  const handleCompletion = useCallback(async (paymentId: string, txid: string) => {
    try {
      await walletApi.completeDeposit(paymentId, txid);
      logger.info(`[PiPay] Payment completed: ${paymentId} txid=${txid}`);
      onPaymentComplete?.();
    } catch (err) {
      logger.error('[PiPay] complete error:', err);
      showToast('Payment completion failed');
    } finally {
      setBusy(false);
    }
  }, [showToast, onPaymentComplete]);

  const handleError = useCallback(async (err: Error, paymentInfo?: PaymentInfo) => {
    if (paymentInfo) {
      try { await walletApi.incompleteDeposit(paymentInfo); } catch { /* swallow */ }
    }
    onError?.(err);
    showToast(err.message || 'Payment error');
    setBusy(false);
  }, [showToast, onError]);

  const handleClick = async () => {
    if (!window.Pi || busy || disabled || !accessToken) return;
    setBusy(true);

    try {
      window.Pi.createPayment(paymentData, {
        onReadyForServerApproval: (paymentId: string) => { handleApproval(paymentId); },
        onReadyForServerCompletion: (paymentId: string, txid: string) => { handleCompletion(paymentId, txid); },
        onCancel: async (paymentId: string) => {
          try { await walletApi.cancelDeposit(paymentId); } catch { /* ignore */ }
          setBusy(false);
        },
        onError: (err: Error, info?: PaymentInfo) => { handleError(err, info); },
      });
    } catch (err) {
      handleError(err instanceof Error ? err : new Error('Payment initiation failed'));
    }
  };

  const isDisabled = disabled || !sdkReady || busy || !accessToken;

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className={className}
      style={{ opacity: isDisabled ? 0.55 : 1 }}
      title={!accessToken ? 'Connect your Pi wallet first' : undefined}
    >
      {busy ? 'Processing…' : children ?? 'Pay with π'}
    </button>
  );
}
