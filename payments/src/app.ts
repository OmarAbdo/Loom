import express from 'express';
import { json } from 'body-parser';
import cookieSession from 'cookie-session';
import {
  errorHandler,
  NotFoundError,
  currentUser,
  serveDocs,
} from '@omarabdo/ticketing-common';
import { createChargeRouter } from './routes/new';
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

// No `:id` route here to collide with, but the docs stay mounted above the
// router for consistency with the other three services.
serveDocs(app, openApiDocument, '/api/payments');

app.use(createChargeRouter);

app.all('*splat', async (req, res) => {
  throw new NotFoundError();
});

app.use(errorHandler);

export { app };
