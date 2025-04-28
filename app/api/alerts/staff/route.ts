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

export async function POST(request: Request) {
  try {
    const { eventId, userId, alertType, message } = await request.json()

    // Validate input
    if (!eventId || !userId || !alertType || !message) {
      return NextResponse.json({ message: "All fields are required" }, { status: 400 })
    }

    // Get connection from pool
    const connection = await pool.getConnection()

    try {
      // Insert alert into database
      await connection.execute(
        `INSERT INTO staff_alerts
        (event_id, alert_type, user_id, message, created_at)
        VALUES (?, ?, ?, ?, NOW())`,
        [eventId, alertType, userId, message],
      )

      // In a real application, you might also:
      // 1. Send an email to bank staff
      // 2. Send a push notification to a staff dashboard
      // 3. Trigger an SMS alert to security team
      // 4. Log to a security monitoring system

      return NextResponse.json({
        message: "Staff alert created successfully",
        alertId: eventId,
      })
    } finally {
      connection.release()
    }
  } catch (error) {
    console.error("Staff alert error:", error)
    return NextResponse.json(
      {
        message: error.message || "Internal server error",
        error: process.env.NODE_ENV === "development" ? error.toString() : undefined,
      },
      { status: 500 },
    )
  }
}
