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
      // Get all accounts for the user
      const [accountsResult] = await connection.execute("SELECT account_id FROM accounts WHERE user_id = ?", [userId])

      const accounts = (accountsResult as any[]).map((acc) => acc.account_id)

      if (accounts.length === 0) {
        return NextResponse.json([])
      }

      // Create placeholders for SQL IN clause
      const placeholders = accounts.map(() => "?").join(",")

      // Query recent transactions for all user accounts
      const [transactions] = await connection.execute(
        `SELECT t.*, 
        CASE WHEN al.is_anomalous = 1 THEN 1 ELSE 0 END as is_anomalous,
        al.anomaly_type
        FROM transactions t
        LEFT JOIN anomaly_labels al ON t.transaction_id = al.event_id
        WHERE t.from_account_id IN (${placeholders}) OR t.to_account_id IN (${placeholders})
        ORDER BY t.transaction_timestamp DESC
        LIMIT 20`,
        [...accounts, ...accounts],
      )

      return NextResponse.json(transactions)
    } finally {
      connection.release()
    }
  } catch (error) {
    console.error("Error fetching transactions:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
