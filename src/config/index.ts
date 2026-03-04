export default {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
    jwtSecret: process.env.JWT_SECRET || 'super-secret-key-change-this',
    jwtExpiration: '15m',
    jwtRefreshExpiration: '7d',
    dbUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
};
