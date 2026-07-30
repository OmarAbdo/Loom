import type { OrderStatus } from '../api/types';

const CLASS: Record<OrderStatus, string> = {
  created: 'badge-created',
  'awaiting:payment': 'badge-awaiting',
  complete: 'badge-complete',
  cancelled: 'badge-cancelled',
};

/** Colored pill for an order status. */
export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`badge ${CLASS[status] ?? 'badge-created'}`}>{status}</span>;
}
