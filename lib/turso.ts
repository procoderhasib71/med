import { createClient } from '@libsql/client';

const rawTurso = createClient({
    url: process.env.TURSO_DATABASE_URL || 'libsql://dummy-url-for-build.turso.io',
    authToken: process.env.TURSO_AUTH_TOKEN || '',
});

// 🚀 Realtime Turso Read Monitor Wrapper
export const turso = {
    ...rawTurso,
    execute: async (stmt: any) => {
        const startTime = Date.now();
        const result = await rawTurso.execute(stmt);
        const duration = Date.now() - startTime;

        const rowCount = result.rows ? result.rows.length : 0;
        const querySql = typeof stmt === 'string' ? stmt : stmt?.sql || '';

        // Terminal-e Live Read Count print hobe
        console.log(
            `🔥 [TURSO READ] ${new Date().toLocaleTimeString()} | Rows: ${rowCount} | Time: ${duration}ms | Query: ${querySql.slice(0, 70)}...`
        );

        return result;
    },
};