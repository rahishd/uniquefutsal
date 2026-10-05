process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://unique:unique_dev_pw@localhost:5439/unique_test?schema=public";
process.env.JWT_SECRET = "test-jwt-secret-0123456789abcdef";
process.env.REFRESH_TOKEN_SECRET = "test-refresh-secret-0123456789abcdef";
process.env.OTP_ENABLED = "false";
process.env.ALLOWED_ORIGINS = "http://localhost:3000";
process.env.GOOGLE_CLIENT_ID = "test-client-id";
