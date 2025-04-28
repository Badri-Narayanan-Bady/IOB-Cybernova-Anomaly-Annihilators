import { NextResponse } from "next/server"
import mysql from "mysql2/promise"
import { generateTOTP, sendOTP, validatePhoneNumber } from "@/lib/otp-service"

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
    const { phoneNumber, action, userId } = await request.json()

    // Validate input
    if (!phoneNumber) {
      return NextResponse.json({ message: "Phone number is required" }, { status: 400 })
    }

    // Validate phone number format
    if (!validatePhoneNumber(phoneNumber)) {
      return NextResponse.json(
        { message: "Invalid phone number format. Please include country code (e.g., +91...)" },
        { status: 400 },
      )
    }

    // Get connection from pool
    const connection = await pool.getConnection()

    try {
      // If userId is not provided, find user by phone number
      let userIdToUse = userId
      let userTOTPSecret = null

      if (!userIdToUse) {
        const [usersResult] = await connection.execute(
          "SELECT user_id, totp_secret FROM users WHERE phone_number = ?",
          [phoneNumber],
        )

        const usersArray = usersResult as any[]
        if (usersArray.length === 0) {
          return NextResponse.json({ message: "User not found" }, { status: 404 })
        }

        userIdToUse = usersArray[0].user_id
        userTOTPSecret = usersArray[0].totp_secret
      } else {
        // Get user's TOTP secret
        const [secretResult] = await connection.execute("SELECT totp_secret FROM users WHERE user_id = ?", [
          userIdToUse,
        ])

        const secretArray = secretResult as any[]
        if (secretArray.length === 0) {
          return NextResponse.json({ message: "User not found" }, { status: 404 })
        }

        userTOTPSecret = secretArray[0].totp_secret
      }

      // Generate time-based OTP
      const otp = generateTOTP(userTOTPSecret)

      // Store OTP in database for reference
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes expiry
      await connection.execute(`INSERT INTO otp_records (user_id, otp, expires_at, purpose) VALUES (?, ?, ?, ?)`, [
        userIdToUse,
        otp,
        expiresAt,
        action || "login",
      ])

      // Send OTP to user's phone via Twilio
      await sendOTP(phoneNumber, otp)

      // Return success response
      return NextResponse.json({
        message: "OTP sent successfully",
        phoneNumber,
      })
    } finally {
      connection.release()
    }
  } catch (error) {
    console.error("Send OTP error:", error)
    return NextResponse.json(
      {
        message: error.message || "Internal server error",
        error: process.env.NODE_ENV === "development" ? error.toString() : undefined,
      },
      { status: 500 },
    )
  }
}
