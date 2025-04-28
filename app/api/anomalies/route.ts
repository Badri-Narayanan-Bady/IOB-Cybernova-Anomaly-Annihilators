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

      // Create placeholders for SQL IN clause
      const accountPlaceholders = accounts.length > 0 ? accounts.map(() => "?").join(",") : "''"

      // Query login anomalies
      const [loginAnomalies] = await connection.execute(
        `SELECT 
          al.event_id, 
          'login' as event_type,
          a.timestamp,
          al.is_anomalous,
          al.anomaly_type,
          ml.score,
          JSON_OBJECT(
            'user_id', a.user_id,
            'typing_speed', a.typing_speed,
            'cursor_movements', a.cursor_movements,
            'session_duration', a.session_duration,
            'latitude', a.latitude,
            'longitude', a.longitude,
            'login_time_of_day', a.login_time_of_day
          ) as details
        FROM anomaly_labels al
        JOIN activity_log a ON al.event_id = a.event_id
        JOIN model_learning_logs ml ON al.event_id = ml.event_id
        WHERE a.user_id = ? AND a.event_type = 'login' AND al.is_anomalous = 1
        ORDER BY a.timestamp DESC
        LIMIT 10`,
        [userId],
      )

      // Query transaction anomalies
      const [transactionAnomalies] = await connection.execute(
        `SELECT 
          al.event_id, 
          'transaction' as event_type,
          t.transaction_timestamp as timestamp,
          al.is_anomalous,
          al.anomaly_type,
          ml.score,
          JSON_OBJECT(
            'from_account_id', t.from_account_id,
            'to_account_id', t.to_account_id,
            'transaction_amount', t.transaction_amount,
            'latitude', t.transaction_latitude,
            'longitude', t.transaction_longitude,
            'from_balance_before', t.from_balance_before,
            'from_balance_after', t.from_balance_after
          ) as details
        FROM anomaly_labels al
        JOIN transactions t ON al.event_id = t.transaction_id
        JOIN model_learning_logs ml ON al.event_id = ml.event_id
        WHERE (t.from_account_id IN (${accountPlaceholders}) OR t.to_account_id IN (${accountPlaceholders}))
        AND al.is_anomalous = 1
        ORDER BY t.transaction_timestamp DESC
        LIMIT 10`,
        [...accounts, ...accounts],
      )

      // Combine and parse the results
      const combinedResults = [
        ...(loginAnomalies as any[]).map((item) => ({
          ...item,
          details: JSON.parse(item.details),
        })),
        ...(transactionAnomalies as any[]).map((item) => ({
          ...item,
          details: JSON.parse(item.details),
        })),
      ]

      // Sort by timestamp (most recent first)
      combinedResults.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      return NextResponse.json(combinedResults)
    } finally {
      connection.release()
    }
  } catch (error) {
    console.error("Error fetching anomalies:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
