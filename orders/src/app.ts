import express from 'express';
import { json } from 'body-parser';
import cookieSession from 'cookie-session';
import {
  errorHandler,
  NotFoundError,
  currentUser,
  serveDocs,
} from '@omarabdo/ticketing-common';
import { deleteOrderRouter } from './routes/delete';
import { indexOrderRouter } from './routes/index';
import { newOrderRouter } from './routes/new';
import { showOrderRouter } from './routes/show';
import { openApiDocument } from './openapi';

const app = express();
app.set('trust proxy', true);
app.use(json());
app.use(
  cookieSession({
    signed: false,
    secure: process.env.NODE_ENV !== 'test',
  })
);
app.use(currentUser);

// Docs FIRST: `/api/orders/:orderId` would otherwise match `/api/orders/docs`
// and fail OrderIdParam's uuid check with a 400. Also note these routes are
// behind requireAuth — mounting docs above them keeps the spec public, which is
// what lets the aggregated /docs gateway fetch it without a session.
serveDocs(app, openApiDocument, '/api/orders');

app.use(deleteOrderRouter);
app.use(indexOrderRouter);
app.use(newOrderRouter);
app.use(showOrderRouter);

app.all('*splat', async (req, res) => {
  throw new NotFoundError();
});

app.use(errorHandler);

export { app };
