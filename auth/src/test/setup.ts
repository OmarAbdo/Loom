import { MongoMemoryServer } from 'mongodb-memory-server'; // MongoDb in memory. nice for testing.
import mongoose from 'mongoose';
import request from 'supertest';
import { app } from '../app';


let mongo: MongoMemoryServer;

declare global {
  var signin: () => Promise<string[] | undefined>;
}

 
// Spinning up an in-memory mongod on Windows regularly exceeds jest's
// default 5s hook timeout, so give the setup/teardown hooks more room.
jest.setTimeout(60000);

beforeAll(async () => {
  process.env.JWT_KEY = 'asdf';

  mongo = await MongoMemoryServer.create();
  const mongoUri = mongo.getUri();

  await mongoose.connect(mongoUri);
});

beforeEach(async () => {
  if (mongoose.connection.db) {
    const collections = await mongoose.connection.db.collections();

    for (let collection of collections) {
      await collection.deleteMany({});
    }
  }
});

afterAll(async () => {
  if (mongo) {
    await mongo.stop();
  }
  await mongoose.connection.close();
});


global.signin = async () => { 
  const email = 'test@test.com'
  const password = 'password'

  const response = await request(app)
    .post('/api/users/signup')
    .send({
      email,
      password
    })
    .expect(201);

  const cookie = response.get('Set-Cookie');

  return cookie;
};