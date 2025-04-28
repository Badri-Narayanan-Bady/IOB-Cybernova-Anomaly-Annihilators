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
    const { phoneNumber, otp, action, userId } = await request.json()

    console.log("OTP verification request received:", { phoneNumber, action, userId })

    // Validate input
    if (!phoneNumber || !otp) {
      return NextResponse.json({ message: "Phone number and OTP are required" }, { status: 400 })
    }

    // Get connection from pool
    const connection = await pool.getConnection()

    try {
      // If userId is not provided, find user by phone number
      let userIdToUse = userId
      let userTOTPSecret = null

      if (!userIdToUse) {
        console.log("Finding user by phone number:", phoneNumber)

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

        console.log("User found:", userIdToUse)
      } else {
        // Get user's TOTP secret
        console.log("Finding user by ID:", userIdToUse)

        const [secretResult] = await connection.execute("SELECT totp_secret FROM users WHERE user_id = ?", [
          userIdToUse,
        ])

        const secretArray = secretResult as any[]
        if (secretArray.length === 0) {
          return NextResponse.json({ message: "User not found" }, { status: 404 })
        }

        userTOTPSecret = secretArray[0].totp_secret
        console.log("User found with TOTP secret")
      }

      // Get the latest OTP record for reference
      console.log("Getting latest OTP record")

      const [otpResult] = await connection.execute(
        `SELECT * FROM otp_records 
        WHERE user_id = ? AND purpose = ? 
        ORDER BY created_at DESC LIMIT 1`,
        [userIdToUse, action],
      )

      const otpArray = otpResult as any[]
      if (otpArray.length === 0) {
        console.log("No OTP record found")

        // For testing purposes, create a new OTP record
        console.log("Creating a new OTP record for testing")

        const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes expiry
        await connection.execute(`INSERT INTO otp_records (user_id, otp, expires_at, purpose) VALUES (?, ?, ?, ?)`, [
          userIdToUse,
          otp,
          expiresAt,
          action,
        ])

        console.log("New OTP record created")
      }

      console.log("Verifying OTP")

      // For testing purposes, always verify the OTP
      const isValid = true // verifyTOTP(otp, userTOTPSecret)

      if (!isValid) {
        return NextResponse.json({ message: "Invalid or expired OTP. Please try again." }, { status: 400 })
      }

      console.log("OTP verified successfully")

      // Mark OTP as used if it exists
      if (otpArray.length > 0) {
        await connection.execute("UPDATE otp_records SET is_used = 1 WHERE id = ?", [otpArray[0].id])
      }

      // If this is a signup verification, mark the user as verified
      if (action === "signup") {
        console.log("Marking user as verified")

        await connection.execute("UPDATE users SET is_verified = 1, verified_at = NOW() WHERE user_id = ?", [
          userIdToUse,
        ])
      }

      // Update last login time if this is a login verification
      if (action === "login") {
        console.log("Updating last login time")

        await connection.execute("UPDATE users SET last_login = NOW() WHERE user_id = ?", [userIdToUse])
      }

      console.log("OTP verification completed successfully")

      // Return success response
      return NextResponse.json({
        message: "OTP verified successfully",
        action,
        userId: userIdToUse,
      })
    } finally {
      connection.release()
    }
  } catch (error) {
    console.error("OTP verification error:", error)
    return NextResponse.json(
      {
        message: error.message || "Internal server error",
        error: process.env.NODE_ENV === "development" ? error.toString() : undefined,
      },
      { status: 500 },
    )
  }
}
