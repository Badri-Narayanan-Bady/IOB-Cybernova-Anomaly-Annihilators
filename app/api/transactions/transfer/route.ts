import { NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"
import mysql from "mysql2/promise"
import { enhancedTransactionAnomalyDetection } from "@/lib/python-model-integration"
import { generateTOTP, sendOTP } from "@/lib/otp-service"
//import { getMysqlConnection } from "@/lib/mysql-connection"

export async function POST(request: Request) {
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
  const connection = await pool.getConnection()
  try {
    const { behavioralMetrics } =
      await request.json()
    const  fromAccountId = "123456789012", toAccountId = "123456789012", amount = 100000, description  = "food", transferType = "external", userId = "70ab2081-1b96-459c-96c3-16e50ce38486"
    if (!fromAccountId || !toAccountId || !amount || amount <= 0) {
      return NextResponse.json({ message: "Invalid transfer details" }, { status: 400 })
    }
    
    // Get source account details
    const [fromRows] = await connection.execute(
      "SELECT * FROM accounts WHERE account_id = ?",
      [fromAccountId]
    ) as [mysql.RowDataPacket[], any]
    const fromAccount = fromRows[0]
    if (!fromAccount) {
      return NextResponse.json({ message: "Source account not found" }, { status: 404 })
    }
    console.log(fromAccount, userId)
    // Check if user owns the source account
    if (fromAccount.user_id !== userId) {
      return NextResponse.json({ message: "Unauthorized access to account" }, { status: 403 })
    }

    // Get destination account details (internal transfer)
    let toAccount: any = null
    const [toRows] = await connection.execute(
      "SELECT * FROM accounts WHERE account_id = ?",
      [toAccountId]
    ) as [mysql.RowDataPacket[], any]
    if (toRows.length > 0) {
      toAccount = toRows[0]
    }

    // Check if sufficient funds
    if (fromAccount.balance < amount) {
      return NextResponse.json({ message: "Insufficient funds" }, { status: 400 })
    }

    // Extract behavioral metrics
    const { cursorMovements, sessionDuration, latitude, longitude } = behavioralMetrics

    // Get transaction frequency for anomaly detection (last 30 days)
    const [recentTransactions] = await connection.execute(
      "SELECT * FROM transactions WHERE from_account_id = ? AND transaction_timestamp >= ?",
      [fromAccountId, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)]
    ) as [mysql.RowDataPacket[], any]
    const transactionFrequency = recentTransactions.length

    // Prepare features for anomaly detection
    const features = {
      from_account_id: fromAccountId,
      to_account_id: toAccountId,
      transaction_amount: amount,
      from_balance: fromAccount.balance,
      to_balance: toAccount?.balance || 0,
      transaction_frequency: transactionFrequency,
      cursor_movements: cursorMovements,
      session_duration: sessionDuration,
      latitude,
      longitude,
      timestamp: new Date().toISOString(),
    }

    // Detect anomalies using the ML model
    const { isAnomaly, anomalyType, score } = await enhancedTransactionAnomalyDetection(features)

    // Generate transaction ID
    const transactionId = uuidv4()

    // Get user data
    const [userRows] = await connection.execute(
      "SELECT * FROM users WHERE user_id = ?",
      [userId]
    ) as [mysql.RowDataPacket[], any]
    const userData = userRows[0]
    if (!userData) {
      return NextResponse.json({ message: "User not found" }, { status: 404 })
    }

    // Start transaction
    await connection.beginTransaction()

    // Insert transaction record
    /*await connection.execute(
      `INSERT INTO transactions (
        transaction_id, from_account_id, to_account_id, transaction_amount, currency, transaction_timestamp,
        transaction_latitude, transaction_longitude, from_balance_before, from_balance_after,
        to_balance_before, to_balance_after, transaction_frequency, description, transfer_type, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        transactionId,
        fromAccountId,
        toAccountId,
        amount,
        "INR",
        new Date(),
        "4.5.6",  // Using nullish coalescing instead of logical OR
        "1.2.3",
        fromAccount.balance,
        fromAccount.balance - amount,
        toAccount?.balance ?? 0,  // Using nullish coalescing
        toAccount ? toAccount.balance + amount : 0,
        transactionFrequency,
        description ?? "Transfer",  // Using nullish coalescing
        transferType,
        userId,
      ]
    )*/

    // Update account balances
    /*await connection.execute(
      "UPDATE accounts SET balance = ? WHERE account_id = ?",
      [fromAccount.balance - amount, fromAccountId]
    )
    if (toAccount) {
      await connection.execute(
        "UPDATE accounts SET balance = ? WHERE account_id = ?",
        [toAccount.balance + amount, toAccountId]
      )
    }

    // Log the ML prediction
    await connection.execute(
      `INSERT INTO model_learning_logs (
        event_id, event_type, features, prediction, score, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        transactionId,
        "transaction",
        JSON.stringify(features),
        isAnomaly ? 1 : 0,
        score,
        new Date(),
      ]
    )*/

    // If anomaly is detected, log it and create staff alert
    let riskLevel = "low"
    if (false) {
      await connection.execute(
        `INSERT INTO anomaly_labels (event_id, is_anomalous, anomaly_type)
         VALUES (?, ?, ?)`,
        [transactionId, true, anomalyType]
      )

      await connection.execute(
        `INSERT INTO staff_alerts (event_id, alert_type, user_id, message, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
          transactionId,
          "transaction_anomaly",
          userId,
          `Suspicious transaction detected: ${anomalyType || "Unknown anomaly"} - Amount: ₹${amount}`,
          new Date(),
        ]
      )

      if (score > 0.8) {
        riskLevel = "high"
      } else if (score > 0.6) {
        riskLevel = "medium"
      }

      // For medium and high risk, generate and send OTP
      if (riskLevel === "medium" || riskLevel === "high") {
        const totp = generateTOTP(userData.totp_secret)
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes expiry

        await connection.execute(
          `INSERT INTO otp_records (user_id, otp, expires_at, purpose)
           VALUES (?, ?, ?, ?)`,
          [userId, totp, expiresAt, "transaction"]
        )

        await sendOTP(userData.phone_number, totp)
      }
    }

    await connection.commit()

    if (/*isAnomaly*/false) {
      return NextResponse.json({
        transactionId,
        userId,
        fromAccountId,
        toAccountId,
        amount,
        timestamp: new Date().toISOString(),
        anomalyDetected: true,
        anomalyType,
        riskLevel,
        score,
      })
    }

    return NextResponse.json({
      transactionId,
      userId,
      fromAccountId,
      toAccountId,
      amount,
      timestamp: new Date().toISOString(),
      anomalyDetected: false,
    })
  } catch (error: any) {
    if (connection) {
      try {
        await connection.rollback()
      } catch {}
    }
    console.error("Transfer error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  } finally {
    if (connection) {
      await connection.release()  // This is the correct way to release a pooled connection
    }  
  }
}