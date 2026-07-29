import express, { Request, Response } from 'express';
import { body } from 'express-validator';
import {
  requireAuth,
  validateRequest,
  NotFoundError,
  BadRequestError,
} from '@omarabdo/ticketing-common';
import { OrderStatus } from '@omarabdo/ticketing-schemas';
import { getDb } from '../db/connection';
import { TicketRepository } from '../repositories/ticket-repository';
import { OrderRepository } from '../repositories/order-repository';
import { OrderCreatedPublisher } from '../events/publishers/order-created-publisher';

const router = express.Router();

const EXPIRATION_WINDOW_SECONDS = 15 * 60;

router.post(
  '/api/orders',
  requireAuth,
  [body('ticketId').not().isEmpty().withMessage('TicketId must be provided')],
  validateRequest,
  async (req: Request, res: Response) => {
    const { ticketId } = req.body;
    const tickets = new TicketRepository(getDb());
    const orders = new OrderRepository(getDb());

    // The ticket must exist in our local replica.
    const ticket = await tickets.findById(ticketId);
    if (!ticket) {
      throw new NotFoundError();
    }

    // It must not already be reserved by an active order.
    if (await tickets.isReserved(ticket.id)) {
      throw new BadRequestError('Ticket is already reserved');
    }

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + EXPIRATION_WINDOW_SECONDS);

    const order = await orders.create({
      userId: req.currentUser!.id,
      status: 'created',
      expiresAt,
      ticketId: ticket.id,
    });

    await new OrderCreatedPublisher().publish({
      id: order.id,
      version: order.version,
      status: OrderStatus.Created,
      userId: order.userId,
      expiresAt: expiresAt.toISOString(),
      ticket: { id: ticket.id, price: ticket.price },
    });

    // Respond with the order plus the embedded ticket (mirrors .populate).
    res.status(201).send({ ...order, ticket });
  }
);

export { router as newOrderRouter };
