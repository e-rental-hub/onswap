import { OrderStatus, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/types';

interface Props { status: OrderStatus; className?: string; }

export default function OrderStatusBadge({ status, className = '' }: Props) {
  return (
    <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full ${ORDER_STATUS_COLORS[status]} ${className}`}>
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}
