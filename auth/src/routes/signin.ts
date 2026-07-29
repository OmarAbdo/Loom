import express, { Request, Response } from 'express';
import { body } from 'express-validator';
import jwt from 'jsonwebtoken';
import { validateRequest, BadRequestError } from '@omarabdo/ticketing-common';
import { Password } from '../services/password';
import { getDb } from '../db/connection';
import { UserRepository } from '../repositories/user-repository';

const router = express.Router();

router.post(
  '/api/users/signin',
  [
    body('email').isEmail().withMessage('Email must be valid'),
    body('password').trim().notEmpty().withMessage('You must supply a password'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const users = new UserRepository(getDb());

    const existingUser = await users.findByEmailWithPassword(email);
    if (!existingUser) {
      throw new BadRequestError('Invalid credentials');
    }

    const passwordsMatch = await Password.compare(existingUser.password, password);
    if (!passwordsMatch) {
      throw new BadRequestError('Invalid Credentials');
    }

    const userJwt = jwt.sign(
      { id: existingUser.id, email: existingUser.email },
      process.env.JWT_KEY!
    );
    req.session = { jwt: userJwt };

    // Never return the password hash.
    res.status(200).send({ id: existingUser.id, email: existingUser.email });
  }
);

export { router as signinRouter };
