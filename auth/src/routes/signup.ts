import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { validateRequest, BadRequestError } from '@omarabdo/ticketing-common';
import { getDb } from '../db/connection';
import { UserRepository } from '../repositories/user-repository';
import { SignupBody } from '../schemas';

const router = express.Router();

router.post(
  '/api/users/signup',
  // Validated against SignupBody (src/schemas): the same schema documents this
  // endpoint in the OpenAPI spec. Unknown keys are stripped before the handler
  // runs, so `req.body` holds exactly `{ email, password }`.
  validateRequest({ body: SignupBody }),
  async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const users = new UserRepository(getDb());

    if (await users.existsByEmail(email)) {
      throw new BadRequestError('Email in use');
    }

    // create() hashes the password before insert.
    const user = await users.create(email, password);

    const userJwt = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_KEY!
    );
    req.session = { jwt: userJwt };

    res.status(201).send(user);
  }
);

export { router as signupRouter };
