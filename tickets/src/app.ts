import express from 'express';
import { json } from 'body-parser';
import cookieSession from 'cookie-session';
import {
  errorHandler,
  NotFoundError,
  currentUser,
} from '@omarabdo/ticketing-common';
import { createTicketRouter } from './routes/new';
import { showTicketRouter } from './routes/show';
import { indexTicketRouter } from './routes/index';
import { updateTicketRouter } from './routes/update';

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

app.use(createTicketRouter);
app.use(showTicketRouter);
app.use(indexTicketRouter);
app.use(updateTicketRouter);

// Express 5 catch-all: bare '*' is invalid under path-to-regexp v8; use a named
// wildcard. Express 5 also forwards async route errors to errorHandler natively,
// so the express-async-errors shim is gone.
app.all('*splat', async (req, res) => {
  throw new NotFoundError();
});

app.use(errorHandler);

export { app };
