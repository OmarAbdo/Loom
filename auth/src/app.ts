import express from 'express';
import { json } from 'body-parser';
import cookieSession from 'cookie-session';
import {
  errorHandler,
  NotFoundError,
  serveDocs,
} from '@omarabdo/ticketing-common';

import { currentUserRouter } from './routes/current-user';
import { signinRouter } from './routes/signin';
import { signoutRouter } from './routes/signout';
import { signupRouter } from './routes/signup';
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

app.use(currentUserRouter);
app.use(signinRouter);
app.use(signoutRouter);
app.use(signupRouter);

// Swagger UI at /api/users/docs, raw spec at /api/users/docs.json.
// Mounted under the service's own API prefix because the ingress routes by
// prefix without rewriting — see the note in common's serveDocs.
// Registered BEFORE the '*splat' catch-all, or every docs request 404s.
serveDocs(app, openApiDocument, '/api/users');

// Express 5 catch-all: named wildcard (bare '*' is invalid under path-to-regexp v8).
app.all('*splat', async (req, res) => {
  throw new NotFoundError();
});

app.use(errorHandler);

export { app };
