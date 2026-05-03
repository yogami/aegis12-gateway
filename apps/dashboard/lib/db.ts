import { Pool, QueryResultRow } from 'pg';

// Create a single connection pool for the entire Next.js application
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Add SSL for remote Railway connection, but allow local dev without it
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
});

export const db = {
    /**
     * Executes a raw SQL query using the connection pool.
     */
    query: async <T extends QueryResultRow = any>(text: string, params?: any[]) => {
        if (!process.env.DATABASE_URL && process.env.USE_MOCK_REPO !== 'true') {
            throw new Error("DATABASE_URL is not defined in the environment variables.");
        }
        return await pool.query<T>(text, params);
    },
    
    /**
     * Gets a dedicated client from the pool (useful for transactions).
     */
    getClient: async () => {
        return await pool.connect();
    }
};
