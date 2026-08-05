import express, { Request, Response } from 'express';
import {
  validateRequest,
  NotFoundError,
  requireAuth,
  NotAuthorizedError,
  BadRequestError,
} from '@omarabdo/ticketing-common';
import { getDb } from '../db/connection';
import { TicketRepository } from '../repositories/ticket-repository';
import { TicketUpdatedPublisher } from '../events/publishers/ticket-updated-publisher';
import { TicketBody, TicketIdParam } from '../schemas';

const router = express.Router();

router.put(
  '/api/tickets/:id',
  requireAuth,
  // Validating the param means a malformed id fails as a clean 400 here rather
  // than reaching Postgres as an invalid uuid literal.
  validateRequest({ body: TicketBody, params: TicketIdParam }),
  async (req: Request, res: Response) => {
    const tickets = new TicketRepository(getDb());
    const ticket = await tickets.findById(req.params.id as string);

    if (!ticket) {
      throw new NotFoundError();
    }
    // A reserved ticket (orderId set) cannot be edited.
    if (ticket.orderId) {
      throw new BadRequestError('Cannot edit a reserved ticket');
    }
    if (ticket.userId !== req.currentUser!.id) {
      throw new NotAuthorizedError();
    }

    // Version-guarded update (OCC). Bumps version to ticket.version + 1.
    const updated = await tickets.update(ticket.id, ticket.version, {
      title: req.body.title,
      price: req.body.price,
    });

    await new TicketUpdatedPublisher().publish({
      id: updated.id,
      title: updated.title,
      price: updated.price,
      userId: updated.userId,
      version: updated.version,
    });

    res.send(updated);
  }
);

export { router as updateTicketRouter };
