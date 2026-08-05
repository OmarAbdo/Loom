import express, { Request, Response } from 'express';
import { requireAuth, validateRequest } from '@omarabdo/ticketing-common';
import { getDb } from '../db/connection';
import { TicketRepository } from '../repositories/ticket-repository';
import { TicketCreatedPublisher } from '../events/publishers/ticket-created-publisher';
import { TicketBody } from '../schemas';

const router = express.Router();

router.post(
  '/api/tickets',
  requireAuth,
  // TicketBody coerces price from its string form and rejects <= 0, so the
  // handler and the Avro `double` on ticket.created both receive a real number.
  validateRequest({ body: TicketBody }),
  async (req: Request, res: Response) => {
    const { title, price } = req.body;
    const tickets = new TicketRepository(getDb());

    const ticket = await tickets.create({
      title,
      price,
      userId: req.currentUser!.id,
    });

    // Publish AFTER the row is committed, keyed by ticket id for ordering.
    await new TicketCreatedPublisher().publish({
      id: ticket.id,
      title: ticket.title,
      price: ticket.price,
      userId: ticket.userId,
      version: ticket.version,
    });

    res.status(201).send(ticket);
  }
);

export { router as createTicketRouter };
