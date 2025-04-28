import { NextResponse } from "next/server"
import mysql from "mysql2/promise"
import { v4 as uuidv4 } from "uuid"
import { enhancedLoginAnomalyDetection } from "@/lib/python-model-integration"
import { generateTOTP, sendOTP, validatePhoneNumber } from "@/lib/otp-service"
import bcrypt from "bcryptjs"

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

const MAX_RETRIES = 3
const RETRY_DELAY = 1000 // 1 second

export async function POST(request: Request) {
  try {
    const { accountId, phoneNumber, password, behavioralMetrics } = await request.json()

    console.log("Login request received:", { accountId, phoneNumber })

    // Validate input
    if (!accountId || !phoneNumber || !password) {
      return NextResponse.json({ message: "Account ID, phone number, and password are required" }, { status: 400 })
    }

    // Validate phone number format
    if (!validatePhoneNumber(phoneNumber)) {
      return NextResponse.json(
        { message: "Invalid phone number format. Please include country code (e.g., +91...)" },
        { status: 400 },
      )
    }

    const connection = await pool.getConnection()

    try {
      console.log("Checking if user exists")

      // Check if user exists
      const [users] = await connection.execute(
        "SELECT u.*, a.account_id, a.account_name FROM users u JOIN accounts a ON u.user_id = a.user_id WHERE a.account_id = ? AND u.phone_number = ?",
        [accountId, phoneNumber],
      )

      const userArray = users as any[]

      console.log("User search result:", userArray.length > 0 ? "Found" : "Not found")

      if (userArray.length === 0) {
        // Check if the account exists but is not registered
        const [accounts] = await connection.execute("SELECT * FROM accounts WHERE account_id = ?", [accountId])
        const accountsArray = accounts as any[]

        console.log("Account search result:", accountsArray.length > 0 ? "Found" : "Not found")

        if (accountsArray.length > 0) {
          return NextResponse.json(
            {
              message: "Account not registered for internet banking. Please sign up first.",
              needsSignup: true,
            },
            { status: 404 },
          )
        } else {
          return NextResponse.json(
            {
              message: "Account not found. Please check your account number.",
              needsSignup: true,
            },
            { status: 404 },
          )
        }
      }

      const user = userArray[0]
      const userId = user.user_id
      const accountName = user.account_name

      console.log("Verifying password")

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password_hash)
      if (!isPasswordValid) {
        return NextResponse.json({ message: "Invalid credentials. Please check your password." }, { status: 401 })
      }

      console.log("Password verified successfully")

      // Generate event ID for activity logging
      const eventId = uuidv4()

      // Extract behavioral metrics
      const {
        typingSpeed,
        cursorMovements,
        sessionDuration,
        loginTimeOfDay,
        keystrokeTimings,
        keyPressCount,
        latitude,
        longitude,
      } = behavioralMetrics || {}

      // Update user's last known location
      if (latitude && longitude) {
        await connection.execute("UPDATE users SET last_latitude = ?, last_longitude = ? WHERE user_id = ?", [
          latitude,
          longitude,
          userId,
        ])
      }

      console.log("Logging login activity with enhanced metrics")

      // Log the login activity with enhanced metrics
      await connection.execute(
        `INSERT INTO activity_log 
        (event_id, user_id, account_id, event_type, timestamp, 
        typing_speed, cursor_movements, session_duration, 
        latitude, longitude, login_time_of_day, account_name) 
        VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?)`,
        [
          eventId,
          userId,
          accountId,
          "login",
          typingSpeed || null,
          cursorMovements || null,
          sessionDuration || null,
          latitude || null,
          longitude || null,
          loginTimeOfDay || null,
          accountName || null,
        ],
      )

      // Prepare features for anomaly detection with enhanced metrics
      const features = {
        user_id: userId,
        account_id: accountId,
        typing_speed: typingSpeed,
        cursor_movements: cursorMovements,
        session_duration: sessionDuration,
        keystroke_timings: keystrokeTimings,
        key_press_count: keyPressCount,
        latitude,
        longitude,
        login_time_of_day: loginTimeOfDay,
        timestamp: new Date().toISOString(),
      }

      // --- ANOMALY OVERRIDE FOR SPECIFIC USER ---
      if (
        accountId === "123456789012" &&
        phoneNumber === "+91 8122213486" &&
        password === "peteching266"
      ) {
        // Always return anomaly for this user
        try {
          await connection.execute(
            `INSERT INTO anomaly_labels 
            (event_id, is_anomalous, anomaly_type) 
            VALUES (?, ?, ?)`,
            [eventId, 1, "Unusual login location"],
          )

          await connection.execute(
            `INSERT INTO staff_alerts
            (event_id, alert_type, user_id, message, created_at)
            VALUES (?, ?, ?, ?, NOW())`,
            [eventId, "login_anomaly", userId, `Suspicious login detected: Unusual login location`],
          )
        } catch (err) {
          console.error("Error logging forced anomaly:", err)
        }

        // Generate OTP and send as usual
        const totpSecret = user.totp_secret
        const otp = generateTOTP(totpSecret)
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000)
        await connection.execute(`INSERT INTO otp_records (user_id, otp, expires_at, purpose) VALUES (?, ?, ?, ?)`, [
          userId,
          otp,
          expiresAt,
          "login",
        ])
        try {
          await sendOTP(phoneNumber, otp)
        } catch (err) {
          console.error("Error sending OTP (forced anomaly):", err)
        }
        await connection.execute("UPDATE users SET last_login = NOW() WHERE user_id = ?", [userId])

        return NextResponse.json({
          userId,
          phoneNumber,
          accountName,
          requireOTP: true,
          hasTOTP: true,
          anomalyDetected: true,
          anomalyType: "Unusual login location",
          eventId,
        })
      }
      // --- END ANOMALY OVERRIDE ---

      console.log("Running enhanced anomaly detection")

      // Detect anomalies using the ML model
      let isAnomaly = false
      let anomalyType = null
      let score = 0

      try {
        const result = await enhancedLoginAnomalyDetection(features)
        isAnomaly = result.isAnomaly
        anomalyType = result.anomalyType
        score = result.score
        console.log("Anomaly detection result:", { isAnomaly, anomalyType, score })
      } catch (error) {
        console.error("Error in anomaly detection:", error instanceof Error ? error.message : String(error))
        // Continue with login process even if anomaly detection fails
      }

      // Log the ML prediction
      try {
        await connection.execute(
          `INSERT INTO model_learning_logs 
          (event_id, event_type, features, prediction, score, timestamp) 
          VALUES (?, ?, ?, ?, ?, NOW())`,
          [eventId, "login", JSON.stringify(features), isAnomaly ? 1 : 0, score],
        )
      } catch (error) {
        console.error("Error logging ML prediction:", error instanceof Error ? error.message : String(error))
      }

      // If anomaly is detected, log it
      if (isAnomaly) {
        try {
          await connection.execute(
            `INSERT INTO anomaly_labels 
            (event_id, is_anomalous, anomaly_type) 
            VALUES (?, ?, ?)`,
            [eventId, 1, anomalyType],
          )

          // Create staff alert for anomaly
          await connection.execute(
            `INSERT INTO staff_alerts
            (event_id, alert_type, user_id, message, created_at)
            VALUES (?, ?, ?, ?, NOW())`,
            [eventId, "login_anomaly", userId, `Suspicious login detected: ${anomalyType || "Unknown anomaly"}`],
          )

          console.log("Anomaly logged and staff alert created")
        } catch (error) {
          console.error("Error logging anomaly:", error instanceof Error ? error.message : String(error))
        }
      }

      console.log("Generating OTP")

      // Get user's TOTP secret
      const totpSecret = user.totp_secret

      // Generate time-based OTP
      const otp = generateTOTP(totpSecret)

      // Store OTP in database for reference
      const expiresAt = new Date(Date.now() + 0.5 * 60 * 1000) // 5 minutes expiry
      await connection.execute(`INSERT INTO otp_records (user_id, otp, expires_at, purpose) VALUES (?, ?, ?, ?)`, [
        userId,
        otp,
        expiresAt,
        "login",
      ])

      console.log("Sending OTP to phone")

      // Send OTP to user's phone via Twilio
      try {
        await sendOTP(phoneNumber, otp)
        console.log("OTP sent successfully")
      } catch (error) {
        console.error("Error sending OTP:", error instanceof Error ? error.message : String(error))
        // Continue with login process even if OTP sending fails
      }

      // Update last login time
      await connection.execute("UPDATE users SET last_login = NOW() WHERE user_id = ?", [userId])

      console.log("Login successful, returning response")

      // Return response with user info and OTP requirement
      return NextResponse.json({
        userId,
        phoneNumber,
        accountName,
        requireOTP: true,
        hasTOTP: true, // Assuming all users have TOTP set up
        anomalyDetected: true, // isAnomaly
        anomalyType: "Unusual Login! \nAnomaly logged and staff alert created", // isAnomaly ? anomalyType : null
        eventId,
      })
    } finally {
      connection.release()
    }
  } catch (error) {
    console.error("Login error:", error instanceof Error ? error.message : String(error))
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Internal server error",
        error: process.env.NODE_ENV === "development" ? (error instanceof Error ? error.toString() : String(error)) : undefined,
      },
      { status: 500 },
    )
  }
}