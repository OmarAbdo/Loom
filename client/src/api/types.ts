/** Shared API response types (mirror the services' response shapes). */

export interface CurrentUser {
  id: string;
  email: string;
}

export interface Ticket {
  id: string;
  title: string;
  price: number;
  userId: string;
  orderId: string | null;
  version: number;
}

export type OrderStatus = 'created' | 'awaiting:payment' | 'complete' | 'cancelled';

export interface Order {
  id: string;
  userId: string;
  status: OrderStatus;
  expiresAt: string | null;
  version: number;
  ticket: { id: string; title: string; price: number };
}
