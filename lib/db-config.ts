import mysql from "mysql2/promise"

// MySQL connection configuration
export const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "itsBady7",
  database: process.env.DB_NAME || "bankdb",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
}

// Create a connection pool
export const pool = mysql.createPool(dbConfig)

// Helper function to execute a query
export async function executeQuery(query: string, params: any[] = []) {
  try {
    const connection = await pool.getConnection()
    try {
      const [results] = await connection.execute(query, params)
      return results
    } finally {
      connection.release()
    }
  } catch (error) {
    console.error("Database error:", error)
    throw error
  }
}
