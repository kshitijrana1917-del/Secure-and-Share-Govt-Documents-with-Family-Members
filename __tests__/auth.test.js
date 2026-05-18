const request = require('supertest');
const app = require('../server');
const { db } = require('../database');

afterAll((done) => {
    db.close(done);
});

describe('Authentication API', () => {
    
    it('should fail if email is not provided when requesting OTP', async () => {
        const res = await request(app)
            .post('/api/auth/request-otp')
            .send({ name: 'Test User' });
        
        expect(res.statusCode).toEqual(400);
        expect(res.body).toHaveProperty('error');
    });

    it('should successfully request an OTP', async () => {
        const res = await request(app)
            .post('/api/auth/request-otp')
            .send({ email: 'test@example.com', name: 'Test User' });
        
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('message');
        expect(res.body.message).toContain('OTP sent');
    });

    it('should fail OTP verification if OTP is invalid', async () => {
        const res = await request(app)
            .post('/api/auth/verify-otp')
            .send({ email: 'test@example.com', otp: '000000' });
        
        expect(res.statusCode).toEqual(400);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toContain('Invalid OTP');
    });
});
