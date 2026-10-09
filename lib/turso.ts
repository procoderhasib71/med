import { createClient } from '@libsql/client';
export const turso = createClient({
    url: process.env.TURSO_DATABASE_URL || 'libsql://dummy-url-for-build.turso.io',
    authToken: process.env.TURSO_AUTH_TOKEN || '',
});