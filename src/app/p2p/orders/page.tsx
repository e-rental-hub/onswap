'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import OrderStatusBadge from '@/components/p2p/OrderStatusBadge';
import { ordersApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Order, OrderStatus, PAYMENT_METHOD_LABELS } from '@/types';
import { logger } from '@/lib/logger';
import BottomNav from '@/components/layout/BottomNav';
import { CURRENCIES } from '@/lib/constants';

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'payment_pending', label: 'Pending' },
  { value: 'payment_sent', label: 'Payment Sent' },
  { value: 'completed', label: 'Completed' },
  { value: 'disputed', label: 'Disputed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function OrdersPage() {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  useEffect(() => { if (!isAuthenticated) router.push('/auth/login'); }, [isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    const params: Record<string, string> = {};
    if (statusFilter) params.status = statusFilter;
    if (roleFilter) params.role = roleFilter;
    ordersApi.getOrders(params)
      .then((r) => setOrders(r.data.orders))
      .catch((e) => logger.error('Failed to load orders:', e))
      .finally(() => setLoading(false));
  }, [isAuthenticated, statusFilter, roleFilter]);

  const completedCount = orders.filter((o) => o.status === 'completed').length;
  const pendingCount = orders.filter((o) => ['payment_pending', 'payment_sent'].includes(o.status)).length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: 'var(--font-display)' }}>My <span className="pi-text">Orders</span></h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Track all your P2P trades</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total Orders', value: orders.length, color: 'var(--pi-gold)' },
            { label: 'Completed', value: completedCount, color: '#4ade80' },
            { label: 'Active', value: pendingCount, color: '#facc15' },
          ].map((s) => (
            <div key={s.label} className="card p-4 text-center">
              <div className="text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-display)', color: s.color }}>{s.value}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {/* Role filter */}
          <div className="flex rounded-xl p-1" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            {[{ value: '', label: 'All' }, { value: 'buyer', label: 'As Buyer' }, { value: 'seller', label: 'As Seller' }].map((r) => (
              <button key={r.value} onClick={() => setRoleFilter(r.value)}
                className="px-4 py-1.5 rounded-lg text-sm transition-all"
                style={{ background: roleFilter === r.value ? 'var(--bg-elevated)' : 'transparent', color: roleFilter === r.value ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {r.label}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="input-dark text-sm" style={{ width: 'auto', padding: '8px 12px' }}>
            {STATUS_FILTERS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        {/* Orders list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card p-5 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl" style={{ background: 'var(--bg-elevated)' }} />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 rounded" style={{ background: 'var(--bg-elevated)', width: '40%' }} />
                    <div className="h-3 rounded" style={{ background: 'var(--bg-elevated)', width: '60%' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="card p-16 text-center">
            <div className="text-4xl mb-4">📦</div>
            <p className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>No orders found</p>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Browse the market to start trading Pi.</p>
            <Link href="/p2p"><button className="btn-pi px-6 py-2.5">Browse Market</button></Link>
          </div>
        ) : (
          <div className="space-y-3 animate-fade-in">
            {orders.map((order) => {
              const isBuyer = order.buyer.id === user?.id || (order.buyer as unknown as { _id: string })._id === user?.id;
              const counterparty = isBuyer ? order.seller : order.buyer;
              const adType = (order.ad as unknown as { type?: string })?.type;

              return (
                <Link key={order._id} href={`/p2p/orders/${order._id}`}>
                  <div className="card p-5 hover:border-opacity-60 transition-all cursor-pointer group"
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(240,160,60,0.2)')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}>
                    <div className="flex items-center gap-4">
                      {/* Icon */}
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                        style={{ background: isBuyer ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${isBuyer ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                        {isBuyer ? '📥' : '📤'}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                            {isBuyer ? 'Buying' : 'Selling'} π{order.piAmount.toLocaleString()}
                          </span>
                          <OrderStatusBadge status={order.status as OrderStatus} />
                        </div>
                        <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                          <span>
                            {CURRENCIES.find((c) => c.code === order?.currency)?.symbol}
                            {order.nairaAmount.toLocaleString()}
                          </span>
                          <span>·</span>
                          <span>{PAYMENT_METHOD_LABELS[order.paymentMethod]}</span>
                          <span>·</span>
                          <span>with {counterparty?.displayName || 'Unknown'}</span>
                        </div>
                      </div>

                      {/* Date + arrow */}
                      <div className="text-right flex-shrink-0">
                        <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                          {new Date(order.createdAt).toLocaleDateString()}
                        </div>
                        <div className="text-lg group-hover:translate-x-1 transition-transform" style={{ color: 'var(--text-muted)' }}>→</div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
