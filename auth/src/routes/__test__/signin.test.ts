import request from 'supertest';
import { app } from '../../app';

const signup = () =>
  request(app).post('/api/users/signup').send({ email: 'test@test.com', password: 'password' });

it('fails when an email that does not exist is supplied', async () => {
  await request(app)
    .post('/api/users/signin')
    .send({ email: 'nobody@test.com', password: 'password' })
    .expect(400);
});

it('fails when an incorrect password is supplied', async () => {
  await signup().expect(201);
  await request(app)
    .post('/api/users/signin')
    .send({ email: 'test@test.com', password: 'wrongpassword' })
    .expect(400);
});

it('responds with a cookie when valid credentials are supplied', async () => {
  await signup().expect(201);
  const response = await request(app)
    .post('/api/users/signin')
    .send({ email: 'test@test.com', password: 'password' })
    .expect(200);

  expect(response.get('Set-Cookie')).toBeDefined();
});
