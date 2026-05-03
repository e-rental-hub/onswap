'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import EscrowBox from '@/components/p2p/EscrowBox';
import OrderChat from '@/components/p2p/OrderChat';
import OrderStatusBadge from '@/components/p2p/OrderStatusBadge';
import { ordersApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Order, OrderStatus, Message, PAYMENT_METHOD_LABELS } from '@/types';
import { logger } from '@/lib/logger';

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [showDispute, setShowDispute] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  useEffect(() => { if (!isAuthenticated) router.push('/auth/login'); }, [isAuthenticated, router]);

  const fetchOrder = useCallback(async () => {
    try {
      const res = await ordersApi.getOrderById(id);
      setOrder(res.data.order);
    } catch (e) {
      logger.error('Failed to load order:', e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  // Poll every 15s for updates
  useEffect(() => {
    const interval = setInterval(fetchOrder, 15000);
    return () => clearInterval(interval);
  }, [fetchOrder]);

  const doAction = async (action: string, reason?: string) => {
    setError('');
    setActionLoading(action);
    try {
      const res = await ordersApi.updateStatus(id, { action, reason });
      setOrder(res.data.order);
      setShowDispute(false);
      setShowCancel(false);
      logger.info(`Order action: ${action}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Action failed';
      setError(msg);
      logger.error('Order action failed:', err);
    } finally {
      setActionLoading('');
    }
  };

  const onNewMessage = (msg: Message) => {
    setOrder((prev) => prev ? { ...prev, messages: [...prev.messages, msg] } : prev);
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Navbar />
      <div className="flex items-center justify-center h-64">
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading order…</div>
      </div>
    </div>
  );

  if (!order || !user) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Navbar />
      <div className="flex items-center justify-center h-64">
        <p style={{ color: 'var(--text-muted)' }}>Order not found.</p>
      </div>
    </div>
  );

  const buyerId = (order.buyer as unknown as { _id: string })._id || order.buyer.id;
  const sellerId = (order.seller as unknown as { _id: string })._id || order.seller.id;
  const isBuyer = buyerId === user.id;
  const isSeller = sellerId === user.id;
  const counterparty = isBuyer ? order.seller : order.buyer;
  const adPaymentDetails = (order.ad as unknown as { paymentDetails?: { type: string; accountName?: string; accountNumber?: string; bankName?: string }[] })?.paymentDetails || [];
  const sellerPaymentDetail = adPaymentDetails.find((d) => d.type === order.paymentMethod);
  const isActive = !['completed', 'cancelled', 'refunded'].includes(order.status);

  // Deadline countdown
  const deadline = order.paymentDeadline ? new Date(order.paymentDeadline) : null;
  const now = new Date();
  const minsLeft = deadline ? Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / 60000)) : null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <button onClick={() => router.push('/p2p/orders')} className="text-sm mb-6 flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
          ← Back to Orders
        </button>

        {/* Title bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                Order <span className="pi-text">#{order._id.slice(-6).toUpperCase()}</span>
              </h1>
              <OrderStatusBadge status={order.status as OrderStatus} />
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {new Date(order.createdAt).toLocaleString()} · {isBuyer ? 'You are buying' : 'You are selling'}
            </p>
          </div>
          {minsLeft !== null && isActive && order.status === 'payment_pending' && (
            <div className="px-4 py-2 rounded-xl text-sm font-mono" style={{
              background: minsLeft < 5 ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.1)',
              border: `1px solid ${minsLeft < 5 ? 'rgba(239,68,68,0.3)' : 'rgba(234,179,8,0.3)'}`,
              color: minsLeft < 5 ? '#f87171' : '#facc15'
            }}>
              ⏱ {minsLeft} min remaining
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left column */}
          <div className="lg:col-span-3 space-y-5">
            {/* Trade summary */}
            <div className="card p-6">
              <h2 className="font-bold mb-4 text-sm" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>TRADE SUMMARY</h2>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Pi Amount', value: `π ${order.piAmount.toLocaleString()}`, color: 'var(--pi-gold)' },
                  { label: 'Naira Amount', value: `₦${order.nairaAmount.toLocaleString()}`, color: 'var(--text-primary)' },
                  { label: 'Price per Pi', value: `₦${order.pricePerPi.toLocaleString()}`, color: 'var(--text-primary)' },
                  { label: 'Payment Method', value: PAYMENT_METHOD_LABELS[order.paymentMethod], color: 'var(--text-primary)' },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg p-3" style={{ background: 'var(--bg-elevated)' }}>
                    <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{item.label}</div>
                    <div className="font-semibold text-sm" style={{ color: item.color }}>{item.value}</div>
                  </div>
                ))}
              </div>

              {/* Counterparty */}
              <div className="mt-4 pt-4 border-t flex items-center gap-3" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
                  style={{ background: 'rgba(240,160,60,0.15)', color: 'var(--pi-gold)' }}>
                  {counterparty?.displayName?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{counterparty?.displayName}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    ⭐ {counterparty?.rating?.toFixed(1)} · {counterparty?.totalTrades} trades · {isBuyer ? 'Seller' : 'Buyer'}
                  </div>
                </div>
              </div>
            </div>

            {/* Payment instructions */}
            {isBuyer && order.status === 'payment_pending' && sellerPaymentDetail && (
              <div className="card p-6" style={{ borderColor: 'rgba(240,160,60,0.2)' }}>
                <h2 className="font-bold mb-4" style={{ fontFamily: 'var(--font-display)', color: 'var(--pi-gold)' }}>
                  💳 Payment Instructions
                </h2>
                <div className="space-y-3 mb-4">
                  {sellerPaymentDetail.accountName && (
                    <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Account Name</span>
                      <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{sellerPaymentDetail.accountName}</span>
                    </div>
                  )}
                  {sellerPaymentDetail.accountNumber && (
                    <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Account Number</span>
                      <span className="font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--pi-gold)', fontSize: '1.1rem' }}>{sellerPaymentDetail.accountNumber}</span>
                    </div>
                  )}
                  {sellerPaymentDetail.bankName && (
                    <div className="flex justify-between items-center py-2" >
                      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Bank</span>
                      <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{sellerPaymentDetail.bankName}</span>
                    </div>
                  )}
                </div>
                <div className="rounded-lg p-3 text-sm mb-4" style={{ background: 'rgba(240,160,60,0.08)', border: '1px solid rgba(240,160,60,0.15)', color: 'var(--pi-gold)' }}>
                  Transfer exactly <strong>₦{order.nairaAmount.toLocaleString()}</strong> to the account above, then click "I've Paid".
                </div>
              </div>
            )}

            {/* Escrow */}
            <EscrowBox escrow={order.escrow} nairaAmount={order.nairaAmount} />

            {/* Chat */}
            <OrderChat
              orderId={order._id}
              messages={order.messages}
              currentUser={user}
              onNewMessage={onNewMessage}
            />
          </div>

          {/* Right column: Actions */}
          <div className="lg:col-span-2 space-y-4">
            {/* Step guide */}
            <div className="card p-5">
              <h2 className="font-bold mb-4 text-sm" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>TRADE STEPS</h2>
              <div className="space-y-3">
                {[
                  { step: 1, label: 'Order Created', done: true },
                  { step: 2, label: 'Pi Locked in Escrow', done: order.escrow.status === 'locked' || order.escrow.status === 'released' },
                  { step: 3, label: 'Buyer Sends Payment', done: ['payment_sent', 'completed'].includes(order.status) },
                  { step: 4, label: 'Seller Confirms & Releases', done: order.status === 'completed' },
                ].map((s) => (
                  <div key={s.step} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0`}
                      style={{
                        background: s.done ? 'rgba(34,197,94,0.15)' : 'var(--bg-elevated)',
                        border: `1px solid ${s.done ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
                        color: s.done ? '#4ade80' : 'var(--text-muted)',
                      }}>
                      {s.done ? '✓' : s.step}
                    </div>
                    <span className="text-sm" style={{ color: s.done ? 'var(--text-primary)' : 'var(--text-muted)' }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            {isActive && (
              <div className="card p-5 space-y-3">
                <h2 className="font-bold mb-3 text-sm" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>ACTIONS</h2>

                {/* Buyer: confirm payment */}
                {isBuyer && order.status === 'payment_pending' && (
                  <button onClick={() => doAction('confirm_payment')} disabled={!!actionLoading}
                    className="btn-buy w-full py-3 rounded-xl font-semibold">
                    {actionLoading === 'confirm_payment' ? 'Confirming…' : "✅ I've Paid — Notify Seller"}
                  </button>
                )}

                {/* Seller: release escrow */}
                {isSeller && order.status === 'payment_sent' && (
                  <div className="space-y-2">
                    <div className="text-xs p-3 rounded-lg" style={{ background: 'rgba(34,197,94,0.07)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.15)' }}>
                      Buyer has confirmed payment. Verify your bank account, then release Pi.
                    </div>
                    <button onClick={() => doAction('release_escrow')} disabled={!!actionLoading}
                      className="btn-pi w-full py-3 rounded-xl font-semibold">
                      {actionLoading === 'release_escrow' ? 'Releasing…' : '🔓 Release Pi to Buyer'}
                    </button>
                  </div>
                )}

                {/* Seller waiting */}
                {isSeller && order.status === 'payment_pending' && (
                  <div className="text-sm p-3 rounded-lg text-center" style={{ background: 'rgba(234,179,8,0.07)', color: '#facc15', border: '1px solid rgba(234,179,8,0.15)' }}>
                    ⏳ Waiting for buyer to send payment…
                  </div>
                )}

                {/* Buyer waiting for release */}
                {isBuyer && order.status === 'payment_sent' && (
                  <div className="text-sm p-3 rounded-lg text-center" style={{ background: 'rgba(99,102,241,0.07)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.15)' }}>
                    ⏳ Payment confirmed. Waiting for seller to release Pi…
                  </div>
                )}

                <div className="border-t pt-3 space-y-2" style={{ borderColor: 'var(--border-subtle)' }}>
                  {/* Dispute */}
                  {!showDispute ? (
                    <button onClick={() => setShowDispute(true)} className="btn-ghost w-full py-2.5 text-sm" style={{ color: '#f87171', borderColor: 'rgba(239,68,68,0.3)' }}>
                      ⚠️ Raise Dispute
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <textarea className="input-dark text-sm w-full resize-none" rows={3} placeholder="Describe the issue…"
                        value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} style={{ resize: 'none' }} />
                      <div className="flex gap-2">
                        <button onClick={() => doAction('dispute', disputeReason)} disabled={!disputeReason || !!actionLoading}
                          className="btn-sell flex-1 py-2 text-sm rounded-lg">
                          {actionLoading === 'dispute' ? 'Submitting…' : 'Submit Dispute'}
                        </button>
                        <button onClick={() => setShowDispute(false)} className="btn-ghost px-4 py-2 text-sm rounded-lg">Cancel</button>
                      </div>
                    </div>
                  )}

                  {/* Cancel */}
                  {order.status === 'payment_pending' && (
                    !showCancel ? (
                      <button onClick={() => setShowCancel(true)} className="btn-ghost w-full py-2.5 text-sm">
                        Cancel Order
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <input className="input-dark text-sm w-full" placeholder="Reason for cancellation (optional)"
                          value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
                        <div className="flex gap-2">
                          <button onClick={() => doAction('cancel', cancelReason)} disabled={!!actionLoading}
                            className="btn-ghost flex-1 py-2 text-sm rounded-lg" style={{ color: '#f87171', borderColor: 'rgba(239,68,68,0.3)' }}>
                            {actionLoading === 'cancel' ? 'Cancelling…' : 'Confirm Cancel'}
                          </button>
                          <button onClick={() => setShowCancel(false)} className="btn-ghost px-4 py-2 text-sm rounded-lg">Back</button>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Completed state */}
            {order.status === 'completed' && (
              <div className="card p-6 text-center" style={{ borderColor: 'rgba(34,197,94,0.2)' }}>
                <div className="text-4xl mb-3">🎉</div>
                <h3 className="font-bold text-lg mb-1" style={{ color: '#4ade80', fontFamily: 'var(--font-display)' }}>Trade Complete!</h3>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  π{order.piAmount} traded for ₦{order.nairaAmount.toLocaleString()}
                </p>
                <div className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
                  Completed {order.completedAt ? new Date(order.completedAt).toLocaleString() : ''}
                </div>
              </div>
            )}

            {/* Cancelled/disputed state */}
            {(order.status === 'cancelled' || order.status === 'disputed') && (
              <div className="card p-6" style={{ borderColor: order.status === 'disputed' ? 'rgba(239,68,68,0.2)' : 'var(--border)' }}>
                <h3 className="font-bold mb-2" style={{ color: order.status === 'disputed' ? '#f87171' : 'var(--text-secondary)' }}>
                  {order.status === 'disputed' ? '⚠️ Dispute Active' : '✕ Order Cancelled'}
                </h3>
                {(order.cancelReason || order.disputeReason) && (
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    {order.cancelReason || order.disputeReason}
                  </p>
                )}
                {order.status === 'disputed' && (
                  <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                    Admin team will review your dispute within 24 hours.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
