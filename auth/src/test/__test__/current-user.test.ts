import request from 'supertest';
import { app } from '../../app';

it('responds with details about the current user', async () => {
    const authResponse = await request(app)
        .post('/api/users/signup')
        .send({
            email: 'test2@example.com',
            password: 'password'
        })
        .expect(201);

    const authCookie = await global.signin();
    // for "No Overload Matches This Call" error
    // what is that error? 
    // Answer: This error occurs when TypeScript cannot find a matching function signature for the method being called.
    // In this case, it is likely due to the type definitions for the `get` method not matching the expected types for the `Set-Cookie` header.
    // in other words, the types for the `get` method do not include the `Set-Cookie` header.
    // similar to potentially undefined type error? answer: Yes, both errors relate to TypeScript's type checking mechanism.
    if (!authCookie) {
        throw new Error('No auth cookie found');
    }

    const response = await request(app)
        .get('/api/users/currentuser')
        .set('Cookie', authCookie)
        .send()
        .expect(200);
});


it("responds with null if not authenticated", async () => {
    const response = await request(app)
        .get('/api/users/currentuser')
        .send()
        .expect(200);
    
    expect(response.body.currentUser).toEqual(null);
});