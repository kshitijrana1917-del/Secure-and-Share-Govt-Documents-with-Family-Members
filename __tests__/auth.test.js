const request = require('supertest');
const { db, initializeDB } = require('../database');
const app = require('../server');

// Mock the email service before importing routes
jest.mock('../utils/emailService', () => ({
    sendOTP: jest.fn().mockResolvedValue(true),
    sendAadhaarOTP: jest.fn().mockResolvedValue(true),
}));

// Mock the SMS service
jest.mock('../utils/messageService', () => ({
    sendSMS: jest.fn().mockResolvedValue(true),
}));

beforeAll(() => initializeDB());

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
        // First, request an OTP
        await request(app)
            .post('/api/auth/request-otp')
            .send({ email: 'test2@example.com', name: 'Test User 2' });
        
        // Then try to verify with invalid OTP
        const res = await request(app)
            .post('/api/auth/verify-otp')
            .send({ email: 'test2@example.com', otp: '000000' });
        
        expect(res.statusCode).toEqual(400);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toContain('Invalid OTP');
    });
});
