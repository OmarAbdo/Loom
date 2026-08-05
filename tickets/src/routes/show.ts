import express, { Request, Response } from 'express';
import { NotFoundError, validateRequest } from '@omarabdo/ticketing-common';
import { getDb } from '../db/connection';
import { TicketRepository } from '../repositories/ticket-repository';
import { TicketIdParam } from '../schemas';

const router = express.Router();

router.get(
  '/api/tickets/:id',
  validateRequest({ params: TicketIdParam }),
  async (req: Request, res: Response) => {
    const ticket = await new TicketRepository(getDb()).findById(
      req.params.id as string
    );

    if (!ticket) {
      throw new NotFoundError();
    }

    res.send(ticket);
  }
);

export { router as showTicketRouter };
