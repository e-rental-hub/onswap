'use client';
import { useState, useCallback, useEffect } from 'react';
import { walletApi } from '@/lib/api';
import { WalletSummary, DepositInfo, WalletTransaction } from '@/types';
import { logger } from '@/lib/logger';

export function useWallet(autoLoad = false) {
  const [summary,      setSummary]      = useState<WalletSummary | null>(null);
  const [depositInfo,  setDepositInfo]  = useState<DepositInfo | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [txLoading,    setTxLoading]    = useState(false);
  const [error,        setError]        = useState('');

  const fetchBalance = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [balRes, infoRes] = await Promise.all([
        walletApi.getBalance(),
        walletApi.getDepositInfo(),
      ]);
      setSummary(balRes.data);
      setDepositInfo(infoRes.data);
    } catch (err) {
      logger.error('fetchBalance error:', err);
      setError('Failed to load wallet');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTransactions = useCallback(async (page = 1) => {
    setTxLoading(true);
    try {
      const res = await walletApi.getTransactions({ page, limit: 20 });
      setTransactions(res.data.transactions);
    } catch (err) {
      logger.error('fetchTransactions error:', err);
    } finally {
      setTxLoading(false);
    }
  }, []);

  // Called after a successful deposit to refresh balance
  const onDepositComplete = useCallback((newBalance: number) => {
    setSummary((prev) =>
      prev ? { ...prev, piBalance: newBalance, totalHeld: newBalance + (prev.lockedBalance ?? 0) } : prev
    );
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    if (autoLoad) { fetchBalance(); fetchTransactions(); }
  }, [autoLoad, fetchBalance, fetchTransactions]);

  return {
    summary,
    depositInfo,
    transactions,
    loading,
    txLoading,
    error,
    fetchBalance,
    fetchTransactions,
    onDepositComplete,
  };
}
