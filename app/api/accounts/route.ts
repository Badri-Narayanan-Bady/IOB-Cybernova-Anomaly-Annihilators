import { NextResponse } from "next/server"
import mysql from "mysql2/promise"

// Create MySQL connection pool
const pool = mysql.createPool({
  host: "127.0.0.1",
  user: "root",
  password: "peter123",
  database: "bankdb",
  port: 3306,
  authPlugins: {
      mysql_clear_password: () => () => {
        return Buffer.from(process.env.DB_PASSWORD || 'peter123' + '\0');}},
  connectAttributes: {
    program_name: 'bank_app',
    _os: process.platform,
    _client_version: '8.0.41'
  },  
  flags: ['--protocol=TCP'],
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
})

export async function GET(request: Request) {
  try {
    // In a real app, you would get the user ID from the session/JWT
    // For demo purposes, we'll use a hardcoded user ID
    const userId = "user123" // Replace with actual user ID extraction logic

    // Get connection from pool
    const connection = await pool.getConnection()

    try {
      // Query accounts for the user
      const [accounts] = await connection.execute(
        `SELECT a.*, 
        (SELECT SUM(
          CASE 
            WHEN t.from_account_id = a.account_id THEN -t.transaction_amount 
            WHEN t.to_account_id = a.account_id THEN t.transaction_amount
            ELSE 0
          END
        ) FROM transactions t 
        WHERE t.from_account_id = a.account_id OR t.to_account_id = a.account_id) as balance
        FROM accounts a
        WHERE a.user_id = ?`,
        [userId],
      )

      return NextResponse.json(accounts)
    } finally {
      connection.release()
    }
  } catch (error) {
    console.error("Error fetching accounts:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
