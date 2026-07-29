import express, { Request, Response } from 'express';
import { requireAuth } from '@omarabdo/ticketing-common';
import { getDb } from '../db/connection';

const router = express.Router();

router.get('/api/orders', requireAuth, async (req: Request, res: Response) => {
  // Return the user's orders, each with its ticket embedded (the old
  // .populate('ticket')) via a join to the local ticket replica.
  const orders = await getDb()
    .selectFrom('orders')
    .innerJoin('tickets', 'tickets.id', 'orders.ticketId')
    .where('orders.userId', '=', req.currentUser!.id)
    .select([
      'orders.id as id',
      'orders.userId as userId',
      'orders.status as status',
      'orders.expiresAt as expiresAt',
      'orders.version as version',
      'tickets.id as ticketId',
      'tickets.title as ticketTitle',
      'tickets.price as ticketPrice',
    ])
    .execute();

  res.send(
    orders.map((o) => ({
      id: o.id,
      userId: o.userId,
      status: o.status,
      expiresAt: o.expiresAt,
      version: o.version,
      ticket: { id: o.ticketId, title: o.ticketTitle, price: o.ticketPrice },
    }))
  );
});

export { router as indexOrderRouter };
