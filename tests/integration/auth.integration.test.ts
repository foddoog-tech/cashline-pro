import request from 'supertest';
import { app } from '../../src/app';

describe('Auth Integration Tests', () => {
    describe('POST /api/v1/auth/register/customer', () => {
        it('should register a new customer', async () => {
            const response = await request(app)
                .post('/api/v1/auth/register/customer')
                .send({
                    phone: '+967700000001',
                    password: 'Test@123',
                    fullName: 'Test Customer',
                    address: 'Test Address, Sana\'a',
                    lat: 15.3694,
                    lng: 44.1910,
                });

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('status', 'success');
            expect(response.body).toHaveProperty('data');
            expect(response.body.data).toHaveProperty('user');
            expect(response.body.data).toHaveProperty('accessToken');
            expect(response.body.data).toHaveProperty('refreshToken');
        });

        it('should return error for duplicate phone', async () => {
            // First registration
            await request(app)
                .post('/api/v1/auth/register/customer')
                .send({
                    phone: '+967700000002',
                    password: 'Test@123',
                    fullName: 'Test Customer',
                    address: 'Test Address',
                    lat: 15.3694,
                    lng: 44.1910,
                });

            // Duplicate registration
            const response = await request(app)
                .post('/api/v1/auth/register/customer')
                .send({
                    phone: '+967700000002',
                    password: 'Test@123',
                    fullName: 'Another Customer',
                    address: 'Another Address',
                    lat: 15.3694,
                    lng: 44.1910,
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('status', 'error');
        });

        it('should return validation error for invalid phone', async () => {
            const response = await request(app)
                .post('/api/v1/auth/register/customer')
                .send({
                    phone: 'invalid-phone',
                    password: 'Test@123',
                    fullName: 'Test Customer',
                    address: 'Test Address',
                    lat: 15.3694,
                    lng: 44.1910,
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('status', 'error');
        });
    });

    describe('POST /api/v1/auth/login', () => {
        beforeAll(async () => {
            // Create a test user
            await request(app)
                .post('/api/v1/auth/register/customer')
                .send({
                    phone: '+967700000003',
                    password: 'Test@123',
                    fullName: 'Login Test User',
                    address: 'Test Address',
                    lat: 15.3694,
                    lng: 44.1910,
                });
        });

        it('should login with valid credentials', async () => {
            const response = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    phone: '+967700000003',
                    password: 'Test@123',
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('status', 'success');
            expect(response.body.data).toHaveProperty('accessToken');
            expect(response.body.data).toHaveProperty('refreshToken');
        });

        it('should return error for invalid password', async () => {
            const response = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    phone: '+967700000003',
                    password: 'WrongPassword',
                });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('status', 'error');
        });

        it('should return error for non-existent user', async () => {
            const response = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    phone: '+967700000999',
                    password: 'Test@123',
                });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('status', 'error');
        });
    });

    describe('POST /api/v1/auth/refresh', () => {
        let refreshToken: string;

        beforeAll(async () => {
            const response = await request(app)
                .post('/api/v1/auth/register/customer')
                .send({
                    phone: '+967700000004',
                    password: 'Test@123',
                    fullName: 'Refresh Test User',
                    address: 'Test Address',
                    lat: 15.3694,
                    lng: 44.1910,
                });

            refreshToken = response.body.data.refreshToken;
        });

        it('should refresh access token with valid refresh token', async () => {
            const response = await request(app)
                .post('/api/v1/auth/refresh')
                .send({ refreshToken });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('status', 'success');
            expect(response.body.data).toHaveProperty('accessToken');
        });

        it('should return error for invalid refresh token', async () => {
            const response = await request(app)
                .post('/api/v1/auth/refresh')
                .send({ refreshToken: 'invalid-token' });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('status', 'error');
        });
    });
});

