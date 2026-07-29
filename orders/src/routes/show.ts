import express, { Request, Response } from 'express';
import {
  requireAuth,
  NotFoundError,
  NotAuthorizedError,
} from '@omarabdo/ticketing-common';
import { getDb } from '../db/connection';
import { OrderRepository } from '../repositories/order-repository';
import { TicketRepository } from '../repositories/ticket-repository';

const router = express.Router();

router.get(
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

    const ticket = await new TicketRepository(getDb()).findById(order.ticketId);
    res.send({ ...order, ticket });
  }
);

export { router as showOrderRouter };
