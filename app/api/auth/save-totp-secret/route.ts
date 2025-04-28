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
    const { userId, totpSecret } = await request.json()

    // Validate input
    if (!userId || !totpSecret) {
      return NextResponse.json({ message: "User ID and TOTP secret are required" }, { status: 400 })
    }

    // Get connection from pool
    const connection = await pool.getConnection()

    try {
      // Update user's TOTP secret
      await connection.execute("UPDATE users SET totp_secret = ? WHERE user_id = ?", [totpSecret, userId])

      // Return success response
      return NextResponse.json({
        message: "TOTP secret saved successfully",
        userId,
      })
    } finally {
      connection.release()
    }
  } catch (error) {
    console.error("Save TOTP secret error:", error)
    return NextResponse.json(
      {
        message: error.message || "Internal server error",
        error: process.env.NODE_ENV === "development" ? error.toString() : undefined,
      },
      { status: 500 },
    )
  }
}
