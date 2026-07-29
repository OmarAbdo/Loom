import express, { Request, Response } from 'express';
import {
  requireAuth,
  NotFoundError,
  NotAuthorizedError,
} from '@omarabdo/ticketing-common';
import { getDb } from '../db/connection';
import { OrderRepository } from '../repositories/order-repository';
import { OrderCancelledPublisher } from '../events/publishers/order-cancelled-publisher';

const router = express.Router();

router.delete(
  '/api/orders/:orderId',
  requireAuth,
  async (req: Request, res: Response) => {
    const orders = new OrderRepository(getDb());
    const order = await orders.findById(req.params.orderId as string);

    if (!order) {
      throw new NotFoundError();
    }
    if (order.userId !== req.currentUser!.id) {
      throw new NotAuthorizedError();
    }

    // Cancel (user-initiated). Version-guarded update bumps the version.
    const cancelled = await orders.updateStatus(order.id, order.version, 'cancelled');

    await new OrderCancelledPublisher().publish({
      id: cancelled.id,
      version: cancelled.version,
      ticket: { id: cancelled.ticketId },
    });

    res.status(204).send(cancelled);
  }
);

export { router as deleteOrderRouter };
