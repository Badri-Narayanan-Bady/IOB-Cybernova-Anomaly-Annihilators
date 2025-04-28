import { NextResponse } from "next/server"
import mysql from "mysql2/promise"
import { v4 as uuidv4 } from "uuid"
import bcrypt from "bcryptjs"
import { generateTOTPSecret, generateTOTP, sendOTP, validatePhoneNumber } from "@/lib/otp-service"

// Create MySQL connection pool with improved settings
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

// Maximum retry attempts for database operations
const MAX_RETRIES = 3
const RETRY_DELAY = 1000 // 1 second

export async function POST(request: Request) {
  try {
    const { accountNumber, fullName, phoneNumber, email, password, accountType, location, behavioralMetrics } =
      await request.json()

    console.log("Signup request received:", { accountNumber, fullName, phoneNumber, email, accountType })

    if (!accountNumber || !fullName || !phoneNumber || !password || !accountType) {
      return NextResponse.json({ message: "All required fields must be provided" }, { status: 400 })
    }

    if (!validatePhoneNumber(phoneNumber)) {
      return NextResponse.json(
        {
          message: "Invalid phone number format. Please include country code (e.g., +91...)",
        },
        { status: 400 },
      )
    }

    let retries = 0
    let success = false
    let userId = ""
    let error = null

    // Retry loop for handling database locks
    while (retries < MAX_RETRIES && !success) {
      const connection = await pool.getConnection()

      try {
        await connection.beginTransaction()

        // Check if account exists
        const [accountsResult] = await connection.execute("SELECT * FROM accounts WHERE account_id = ?", [
          accountNumber,
        ])

        const accountsArray = accountsResult as any[]
        console.log("Account search result:", accountsArray.length > 0 ? "Found" : "Not found")

        const newAccountId = accountNumber

        if (accountsArray.length === 0) {
          console.log("Account not found, creating a new one for testing")

          // Create a new account with a shorter timeout
          await connection.execute(
            `INSERT INTO accounts 
            (account_id, account_type, account_name, initial_balance) 
            VALUES (?, ?, ?, ?)`,
            [
              newAccountId,
              accountType,
              `${fullName}'s ${accountType.charAt(0).toUpperCase() + accountType.slice(1)} Account`,
              10000.0,
            ],
          )

          console.log("New account created:", newAccountId)
        } else {
          const account = accountsArray[0]
          if (account.user_id) {
            const [usersResult] = await connection.execute("SELECT * FROM users WHERE user_id = ?", [account.user_id])
            if ((usersResult as any[]).length > 0) {
              return NextResponse.json(
                {
                  message: "This account is already registered for internet banking",
                },
                { status: 409 },
              )
            }
          }
        }

        // Check if phone number is already registered
        const [phoneResult] = await connection.execute("SELECT * FROM users WHERE phone_number = ?", [phoneNumber])
        if ((phoneResult as any[]).length > 0) {
          return NextResponse.json(
            {
              message: "This phone number is already registered",
            },
            { status: 409 },
          )
        }

        // Create new user
        userId = uuidv4()
        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password, salt)
        const totpSecret = generateTOTPSecret()
        const otp = generateTOTP(totpSecret)

        // Extract behavioral metrics and location data
        const { typingSpeed, cursorMovements, sessionDuration, keystrokeTimings, keyPressCount } =
          behavioralMetrics || {}

        const latitude = location?.latitude || null
        const longitude = location?.longitude || null

        console.log("Creating new user:", { userId, fullName, phoneNumber })

        await connection.execute(
          `INSERT INTO users 
          (user_id, full_name, phone_number, email, password_hash, totp_secret, created_at, last_latitude, last_longitude, is_verified) 
          VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?, 1)`,
          [userId, fullName, phoneNumber, email || null, hashedPassword, totpSecret, latitude, longitude],
        )

        await connection.execute("UPDATE accounts SET user_id = ? WHERE account_id = ?", [userId, accountNumber])

        // Log the signup activity with behavioral metrics
        const eventId = uuidv4()
        await connection.execute(
          `INSERT INTO activity_log 
          (event_id, user_id, account_id, event_type, timestamp, 
          typing_speed, cursor_movements, session_duration, 
          latitude, longitude, account_name) 
          VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?)`,
          [
            eventId,
            userId,
            accountNumber,
            "signup",
            typingSpeed || null,
            cursorMovements || null,
            sessionDuration || null,
            latitude || null,
            longitude || null,
            `${fullName}'s ${accountType.charAt(0).toUpperCase() + accountType.slice(1)} Account`,
          ],
        )

        const expiresAt = new Date(Date.now() + 5 * 60 * 1000)
        await connection.execute(`INSERT INTO otp_records (user_id, otp, expires_at, purpose) VALUES (?, ?, ?, ?)`, [
          userId,
          otp,
          expiresAt,
          "signup",
        ])

        try {
          await sendOTP(phoneNumber, otp)
          console.log("OTP sent successfully")
        } catch (otpError) {
          console.error("Error sending OTP:", otpError)
          // Proceed even if OTP fails to send
        }

        await connection.commit()
        success = true
        console.log("Transaction committed, signup successful")
      } catch (err) {
        await connection.rollback()
        error = err
        console.error("Signup error:", err)

        // Only retry on lock timeout errors
        if (err.code === "ER_LOCK_WAIT_TIMEOUT") {
          retries++
          console.log(`Retrying operation (${retries}/${MAX_RETRIES})...`)
          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY))
        } else {
          // For other errors, don't retry
          break
        }
      } finally {
        connection.release()
      }
    }

    if (!success) {
      throw error || new Error("Failed to create account after multiple retries")
    }

    return NextResponse.json({
      message: "Account registration initiated. Please verify your phone number.",
      userId,
      phoneNumber,
    })
  } catch (error: any) {
    console.error("Signup error:", error)
    return NextResponse.json(
      {
        message: error.message || "Internal server error",
        error: process.env.NODE_ENV === "development" ? error.toString() : undefined,
      },
      { status: 500 },
    )
  }
}
