import express, { Request, Response } from 'express';
import { getDb } from '../db/connection';

const router = express.Router();

router.get('/api/tickets', async (req: Request, res: Response) => {
  // Return all tickets (preserves the original Ticket.find({}) behavior).
  const tickets = await getDb()
    .selectFrom('tickets')
    .select(['id', 'title', 'price', 'userId', 'orderId', 'version'])
    .execute();

  res.send(tickets);
});

export { router as indexTicketRouter };
