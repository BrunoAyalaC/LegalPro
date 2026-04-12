// Setup: env vars necesarias para que los módulos del servidor no crasheen al importar
process.env.JWT_SECRET = 'TestSmokeKey_MustBe32CharsLongForValidation!';
process.env.DATABASE_URL = 'postgresql://postgres:test@localhost:5432/legalpro_test';
process.env.GEMINI_API_KEY = 'fake-gemini-key-for-testing';
process.env.NODE_ENV = 'test';
// Mantener vars Supabase para tests que todavía mockean supabase.js
process.env.SUPABASE_URL = 'https://fake-test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'fake-service-key-for-testing';
process.env.SUPABASE_ANON_KEY = 'fake-anon-key-for-testing';

