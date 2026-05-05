'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar          from '@/components/layout/Navbar';
import { ordersApi }   from '@/lib/api';
import { useAuth }     from '@/hooks/useAuth';
import { Order, OrderStatus, Message, PAYMENT_METHOD_LABELS, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/types';
import { logger }      from '@/lib/logger';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full ${ORDER_STATUS_COLORS[status]}`}>
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}

function StepRow({ n, label, done, active }: { n: number; label: string; done: boolean; active?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={{
          background: done ? 'rgba(34,197,94,0.15)' : active ? 'rgba(240,160,60,0.12)' : 'var(--bg-elevated)',
          border:     `1px solid ${done ? 'rgba(34,197,94,0.3)' : active ? 'rgba(240,160,60,0.3)' : 'var(--border)'}`,
          color:      done ? '#4ade80' : active ? 'var(--pi-gold)' : 'var(--text-muted)',
        }}>
        {done ? '✓' : n}
      </div>
      <span className="text-sm" style={{ color: done ? 'var(--text-primary)' : active ? 'var(--pi-gold)' : 'var(--text-muted)' }}>
        {label}
      </span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrderDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const { user, isAuthenticated } = useAuth();

  const [order,         setOrder]         = useState<Order | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error,         setError]         = useState('');
  const [chatMsg,       setChatMsg]       = useState('');
  const [sendingMsg,    setSendingMsg]    = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [cancelReason,  setCancelReason]  = useState('');
  const [showDispute,   setShowDispute]   = useState(false);
  const [showCancel,    setShowCancel]    = useState(false);

  useEffect(() => { if (!isAuthenticated) router.push('/auth/login'); }, [isAuthenticated, router]);

  // ── Fetch order ──────────────────────────────────────────────────────────────
  const fetchOrder = useCallback(async () => {
    try {
      const res = await ordersApi.getOrderById(id);
      setOrder(res.data.order);
    } catch (e) {
      logger.error('fetchOrder error:', e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);
  // Poll every 12s for status updates
  useEffect(() => {
    const t = setInterval(fetchOrder, 12000);
    return () => clearInterval(t);
  }, [fetchOrder]);

  // ── Actions ──────────────────────────────────────────────────────────────────
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
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Action failed';
      setError(msg);
      logger.error('Order action failed:', err);
    } finally {
      setActionLoading('');
    }
  };

  const sendChat = async () => {
    if (!chatMsg.trim() || sendingMsg) return;
    setSendingMsg(true);
    try {
      const res = await ordersApi.sendMessage(id, { content: chatMsg.trim() });
      setOrder((prev) => prev
        ? { ...prev, messages: [...prev.messages, res.data.message] }
        : prev
      );
      setChatMsg('');
    } catch (e) {
      logger.error('sendChat error:', e);
    } finally {
      setSendingMsg(false);
    }
  };

  const onNewMessage = (msg: Message) =>
    setOrder((prev) => prev ? { ...prev, messages: [...prev.messages, msg] } : prev);
  void onNewMessage; // exposed for future use

  // ── Loading / error states ───────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Navbar />
      <div className="flex items-center justify-center h-64">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading order…</p>
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

  // ── Derived ──────────────────────────────────────────────────────────────────
  const buyerId  = (order.buyer  as unknown as { _id?: string; id?: string })._id ?? order.buyer.id;
  const sellerId = (order.seller as unknown as { _id?: string; id?: string })._id ?? order.seller.id;
  const isBuyer  = buyerId  === user.id;
  const isSeller = sellerId === user.id;

  const counterparty  = isBuyer ? order.seller : order.buyer;
  const isActive      = !['completed', 'cancelled', 'refunded'].includes(order.status);

  // Payment details from the ad (seller's account)
  const adPaymentDetails = (order.ad as unknown as {
    paymentDetails?: { type: string; accountName?: string; accountNumber?: string; bankName?: string }[]
  })?.paymentDetails ?? [];
  const sellerPaymentDetail = adPaymentDetails.find((d) => d.type === order.paymentMethod);

  // Countdown
  const deadline  = order.paymentDeadline ? new Date(order.paymentDeadline) : null;
  const minsLeft  = deadline ? Math.max(0, Math.floor((deadline.getTime() - Date.now()) / 60000)) : null;
  const isUrgent  = minsLeft !== null && minsLeft < 5;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 py-8">
        <button onClick={() => router.push('/p2p/orders')} className="text-sm mb-6 flex items-center gap-1"
          style={{ color: 'var(--text-secondary)' }}>
          ← Back to Orders
        </button>

        {/* ── Title bar ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                Order <span className="pi-text">#{order._id.slice(-6).toUpperCase()}</span>
              </h1>
              <StatusBadge status={order.status as OrderStatus} />
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {new Date(order.createdAt).toLocaleString()} · {isBuyer ? 'You are buying' : 'You are selling'}
            </p>
          </div>

          {/* Countdown */}
          {minsLeft !== null && isActive && order.status === 'payment_pending' && (
            <div className="px-4 py-2 rounded-xl text-sm font-mono"
              style={{
                background: isUrgent ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.1)',
                border:     `1px solid ${isUrgent ? 'rgba(239,68,68,0.3)' : 'rgba(234,179,8,0.3)'}`,
                color:      isUrgent ? '#f87171' : '#facc15',
              }}>
              ⏱ {minsLeft} min remaining
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg text-sm"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* ══════════════════════════════════════════════════════════════
              LEFT column
          ══════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-3 space-y-5">

            {/* Trade summary */}
            <div className="card p-6">
              <p className="text-xs font-medium mb-4" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>TRADE SUMMARY</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Pi Amount',    value: `π${order.piAmount.toLocaleString()}`,     mono: true,  highlight: true  },
                  { label: 'Naira Amount', value: `₦${order.nairaAmount.toLocaleString()}`,  mono: true,  highlight: false },
                  { label: 'Rate',         value: `₦${order.pricePerPi.toLocaleString()}/π`, mono: false, highlight: false },
                  { label: 'Method',       value: PAYMENT_METHOD_LABELS[order.paymentMethod], mono: false, highlight: false },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl p-3"
                    style={{ background: 'var(--bg-elevated)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                    <p className="font-bold text-sm"
                      style={{
                        color:      item.highlight ? 'var(--pi-gold)' : 'var(--text-primary)',
                        fontFamily: item.mono ? 'var(--font-mono)' : 'inherit',
                      }}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Counterparty */}
              <div className="mt-4 pt-4 border-t flex items-center gap-3" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
                  style={{ background: 'rgba(240,160,60,0.12)', color: 'var(--pi-gold)' }}>
                  {counterparty?.displayName?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {counterparty?.displayName}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    ⭐ {counterparty?.rating?.toFixed(1)} · {counterparty?.totalTrades} trades · {isBuyer ? 'Seller' : 'Buyer'}
                  </p>
                </div>
              </div>
            </div>

            {/* Escrow status */}
            <div className="card p-5">
              <p className="text-xs font-medium mb-4" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>ESCROW</p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{
                    background: order.escrow.status === 'locked'   ? 'rgba(249,115,22,0.1)'  :
                                order.escrow.status === 'released' ? 'rgba(34,197,94,0.1)'   :
                                order.escrow.status === 'refunded' ? 'rgba(113,113,122,0.1)' : 'rgba(234,179,8,0.1)',
                    border:     `1px solid ${
                                order.escrow.status === 'locked'   ? 'rgba(249,115,22,0.25)' :
                                order.escrow.status === 'released' ? 'rgba(34,197,94,0.25)'  :
                                order.escrow.status === 'refunded' ? 'rgba(113,113,122,0.2)' : 'rgba(234,179,8,0.2)'}`,
                  }}>
                  {order.escrow.status === 'locked'   ? '🔒' :
                   order.escrow.status === 'released' ? '✅' :
                   order.escrow.status === 'refunded' ? '↩️' : '⏳'}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm" style={{
                    color: order.escrow.status === 'locked'   ? '#fb923c' :
                           order.escrow.status === 'released' ? '#4ade80' : 'var(--text-secondary)',
                  }}>
                    {order.escrow.status === 'locked'   ? 'Pi Locked in Escrow' :
                     order.escrow.status === 'released' ? 'Pi Released to Buyer' :
                     order.escrow.status === 'refunded' ? 'Pi Refunded'         : 'Pending Lock'}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    π{order.escrow.piAmount.toFixed(4)} · {order.escrow.txId}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--pi-gold)' }}>
                    π{order.escrow.piAmount.toFixed(4)}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    ≈ ₦{order.nairaAmount.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Buyer payment instructions — shown when buyer needs to pay */}
            {isBuyer && order.status === 'payment_pending' && sellerPaymentDetail && (
              <div className="card p-6" style={{ borderColor: 'rgba(240,160,60,0.25)' }}>
                <p className="font-bold mb-4" style={{ fontFamily: 'var(--font-display)', color: 'var(--pi-gold)' }}>
                  💳 Send Payment To
                </p>
                <div className="space-y-3 mb-4">
                  {[
                    { label: 'Account Name',   value: sellerPaymentDetail.accountName },
                    { label: 'Account Number', value: sellerPaymentDetail.accountNumber, mono: true, large: true },
                    { label: 'Bank',           value: sellerPaymentDetail.bankName },
                  ].filter((r) => r.value).map((row) => (
                    <div key={row.label} className="flex justify-between items-center py-2.5 border-b"
                      style={{ borderColor: 'var(--border-subtle)' }}>
                      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                      <span className="font-bold"
                        style={{
                          fontFamily: row.mono ? 'var(--font-mono)' : 'inherit',
                          color:      row.mono ? 'var(--pi-gold)'   : 'var(--text-primary)',
                          fontSize:   row.large ? '1.1rem'           : '0.875rem',
                        }}>
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl p-4"
                  style={{ background: 'rgba(240,160,60,0.08)', border: '1px solid rgba(240,160,60,0.2)' }}>
                  <p className="text-sm" style={{ color: 'var(--pi-gold)' }}>
                    Transfer exactly <strong>₦{order.nairaAmount.toLocaleString()}</strong> via{' '}
                    {PAYMENT_METHOD_LABELS[order.paymentMethod]}, then click "I've Paid".
                  </p>
                </div>
              </div>
            )}

            {/* Chat */}
            <div className="card flex flex-col" style={{ height: '380px' }}>
              <div className="px-4 py-3 border-b flex items-center gap-2 flex-shrink-0"
                style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Order Chat</span>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {order.messages.length === 0 && (
                  <p className="text-center text-sm py-8" style={{ color: 'var(--text-muted)' }}>
                    No messages yet.
                  </p>
                )}
                {order.messages.map((msg, i) => {
                  const senderId = typeof msg.sender === 'string' ? msg.sender : (msg.sender as unknown as { _id?: string; id?: string })._id ?? msg.sender.id;
                  const isMe     = senderId === user.id;
                  const isSystem = msg.type === 'system';

                  if (isSystem) return (
                    <div key={i} className="text-center text-xs px-4 py-2 rounded-lg mx-4"
                      style={{ background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.2)' }}>
                      {msg.content}
                    </div>
                  );

                  return (
                    <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div style={{ maxWidth: '75%' }}>
                        <div className={`px-4 py-2.5 text-sm rounded-2xl ${isMe ? 'rounded-br-sm' : 'rounded-bl-sm'}`}
                          style={{
                            background: isMe
                              ? 'linear-gradient(135deg,rgba(240,160,60,0.2),rgba(236,133,24,0.15))'
                              : 'var(--bg-elevated)',
                            border:     `1px solid ${isMe ? 'rgba(240,160,60,0.2)' : 'var(--border)'}`,
                            color:      'var(--text-primary)',
                          }}>
                          {msg.content}
                        </div>
                        <p className={`text-xs mt-1 ${isMe ? 'text-right' : ''}`} style={{ color: 'var(--text-muted)' }}>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="px-4 py-3 border-t flex gap-2 flex-shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
                <input
                  className="input-dark flex-1 text-sm"
                  style={{ padding: '8px 12px' }}
                  placeholder="Type a message…"
                  value={chatMsg}
                  onChange={(e) => setChatMsg(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChat()}
                  disabled={!isActive}
                />
                <button onClick={sendChat} disabled={!chatMsg.trim() || sendingMsg || !isActive}
                  className="btn-pi px-4 py-2 text-sm" style={{ minWidth: 60 }}>
                  {sendingMsg ? '…' : 'Send'}
                </button>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════
              RIGHT column — steps + actions
          ══════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-2 space-y-4">

            {/* Trade steps */}
            <div className="card p-5">
              <p className="text-xs font-medium mb-4" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>TRADE STEPS</p>
              <div className="space-y-3">
                <StepRow n={1} label="Order Created"
                  done={true} />
                <StepRow n={2} label="Pi Locked in Escrow"
                  done={['locked','released'].includes(order.escrow.status)}
                  active={order.escrow.status === 'pending'} />
                <StepRow n={3} label="Buyer Sends Payment"
                  done={['payment_sent','completed'].includes(order.status)}
                  active={order.status === 'payment_pending'} />
                <StepRow n={4} label="Seller Releases Pi"
                  done={order.status === 'completed'}
                  active={order.status === 'payment_sent'} />
              </div>
            </div>

            {/* Actions */}
            {isActive && (
              <div className="card p-5 space-y-3">
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>ACTIONS</p>

                {/* ── Buyer: confirm payment sent ── */}
                {isBuyer && order.status === 'payment_pending' && (
                  <button onClick={() => doAction('confirm_payment')} disabled={!!actionLoading}
                    className="w-full py-3 rounded-xl font-semibold text-sm"
                    style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }}>
                    {actionLoading === 'confirm_payment' ? 'Confirming…' : "✅ I've Paid — Notify Seller"}
                  </button>
                )}

                {/* ── Seller: release Pi ── */}
                {isSeller && order.status === 'payment_sent' && (
                  <div className="space-y-2">
                    <div className="text-xs p-3 rounded-lg"
                      style={{ background: 'rgba(34,197,94,0.07)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.15)' }}>
                      Buyer confirmed payment. Check your account, then release Pi.
                    </div>
                    <button onClick={() => doAction('release_escrow')} disabled={!!actionLoading}
                      className="btn-pi w-full py-3 rounded-xl font-semibold text-sm">
                      {actionLoading === 'release_escrow' ? 'Releasing…' : '🔓 Release Pi to Buyer'}
                    </button>
                  </div>
                )}

                {/* ── Waiting states ── */}
                {isSeller && order.status === 'payment_pending' && (
                  <div className="text-sm p-3 rounded-lg text-center"
                    style={{ background: 'rgba(234,179,8,0.07)', color: '#facc15', border: '1px solid rgba(234,179,8,0.15)' }}>
                    ⏳ Waiting for buyer to send payment…
                  </div>
                )}
                {isBuyer && order.status === 'payment_sent' && (
                  <div className="text-sm p-3 rounded-lg text-center"
                    style={{ background: 'rgba(99,102,241,0.07)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.15)' }}>
                    ⏳ Payment confirmed. Waiting for seller to release Pi…
                  </div>
                )}

                <div className="border-t pt-3 space-y-2" style={{ borderColor: 'var(--border-subtle)' }}>

                  {/* Dispute */}
                  {!showDispute ? (
                    <button onClick={() => setShowDispute(true)}
                      className="btn-ghost w-full py-2.5 text-sm"
                      style={{ color: '#f87171', borderColor: 'rgba(239,68,68,0.3)' }}>
                      ⚠️ Raise Dispute
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <textarea className="input-dark text-sm w-full" rows={3} style={{ resize: 'none' }}
                        placeholder="Describe the issue…"
                        value={disputeReason}
                        onChange={(e) => setDisputeReason(e.target.value)} />
                      <div className="flex gap-2">
                        <button onClick={() => doAction('dispute', disputeReason)}
                          disabled={!disputeReason || !!actionLoading}
                          className="flex-1 py-2 text-sm rounded-lg font-semibold"
                          style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
                          {actionLoading === 'dispute' ? 'Submitting…' : 'Submit'}
                        </button>
                        <button onClick={() => setShowDispute(false)} className="btn-ghost px-4 py-2 text-sm rounded-lg">
                          Back
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Cancel — only before payment sent */}
                  {order.status === 'payment_pending' && (
                    !showCancel ? (
                      <button onClick={() => setShowCancel(true)} className="btn-ghost w-full py-2.5 text-sm">
                        Cancel Order
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <input className="input-dark text-sm w-full"
                          placeholder="Reason (optional)"
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)} />
                        <div className="flex gap-2">
                          <button onClick={() => doAction('cancel', cancelReason)} disabled={!!actionLoading}
                            className="btn-ghost flex-1 py-2 text-sm rounded-lg"
                            style={{ color: '#f87171', borderColor: 'rgba(239,68,68,0.3)' }}>
                            {actionLoading === 'cancel' ? 'Cancelling…' : 'Confirm Cancel'}
                          </button>
                          <button onClick={() => setShowCancel(false)} className="btn-ghost px-4 py-2 text-sm rounded-lg">
                            Back
                          </button>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Completed */}
            {order.status === 'completed' && (
              <div className="card p-6 text-center" style={{ borderColor: 'rgba(34,197,94,0.2)' }}>
                <p className="text-4xl mb-3">🎉</p>
                <h3 className="font-bold text-lg mb-1" style={{ color: '#4ade80', fontFamily: 'var(--font-display)' }}>
                  Trade Complete!
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  π{order.piAmount} for ₦{order.nairaAmount.toLocaleString()}
                </p>
                {order.completedAt && (
                  <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                    {new Date(order.completedAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {/* Cancelled / disputed */}
            {(order.status === 'cancelled' || order.status === 'disputed') && (
              <div className="card p-6"
                style={{ borderColor: order.status === 'disputed' ? 'rgba(239,68,68,0.2)' : 'var(--border)' }}>
                <h3 className="font-bold mb-2"
                  style={{ color: order.status === 'disputed' ? '#f87171' : 'var(--text-secondary)' }}>
                  {order.status === 'disputed' ? '⚠️ Dispute Active' : '✕ Order Cancelled'}
                </h3>
                {(order.cancelReason || order.disputeReason) && (
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    {order.cancelReason ?? order.disputeReason}
                  </p>
                )}
                {order.status === 'disputed' && (
                  <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                    Admin will review within 24 hours.
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
