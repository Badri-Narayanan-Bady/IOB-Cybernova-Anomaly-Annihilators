import { NextResponse } from "next/server"
import mysql from "mysql2/promise"
import bcrypt from "bcryptjs"
import { v4 as uuidv4 } from "uuid"
import { generateTOTPSecret } from "@/lib/otp-service"

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
    // Get connection from pool
    const connection = await pool.getConnection()

    try {
      // Start transaction
      await connection.beginTransaction()

      console.log("Starting database initialization...")

      // Create tables if they don't exist - using the updated schema
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS users (
          user_id VARCHAR(64) PRIMARY KEY,
          full_name VARCHAR(255),
          phone_number VARCHAR(20),
          email VARCHAR(255),
          password_hash VARCHAR(255),
          totp_secret VARCHAR(255),
          is_verified TINYINT(1) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_latitude DECIMAL(10,8),
          last_longitude DECIMAL(11,8)
        )
      `)

      await connection.execute(`
        CREATE TABLE IF NOT EXISTS accounts (
          account_id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64),
          account_type VARCHAR(20),
          account_name VARCHAR(255),
          initial_balance DECIMAL(10,2),
          FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
        )
      `)

      await connection.execute(`
        CREATE TABLE IF NOT EXISTS transactions (
          transaction_id VARCHAR(64) PRIMARY KEY,
          from_account_id VARCHAR(64),
          to_account_id VARCHAR(64),
          transaction_amount DECIMAL(15,2),
          currency VARCHAR(5) DEFAULT 'USD',
          transaction_timestamp DATETIME,
          transaction_latitude FLOAT,
          transaction_longitude FLOAT,
          from_balance_before DECIMAL(15,2),
          from_balance_after DECIMAL(15,2),
          to_balance_before DECIMAL(15,2),
          to_balance_after DECIMAL(15,2),
          transaction_frequency INT,
          FOREIGN KEY (from_account_id) REFERENCES accounts(account_id),
          FOREIGN KEY (to_account_id) REFERENCES accounts(account_id)
        )
      `)

      await connection.execute(`
        CREATE TABLE IF NOT EXISTS activity_log (
          event_id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64),
          account_id VARCHAR(64),
          event_type VARCHAR(20),
          timestamp DATETIME,
          amount DECIMAL(15,2),
          latitude FLOAT,
          longitude FLOAT,
          typing_speed FLOAT,
          cursor_movements INT,
          session_duration INT,
          login_time_of_day VARCHAR(20),
          account_name VARCHAR(255),
          FOREIGN KEY (user_id) REFERENCES users(user_id),
          FOREIGN KEY (account_id) REFERENCES accounts(account_id)
        )
      `)

      await connection.execute(`
        CREATE TABLE IF NOT EXISTS model_learning_logs (
          event_id VARCHAR(64) PRIMARY KEY,
          event_type ENUM('login','transaction'),
          features JSON,
          prediction TINYINT(1),
          score FLOAT,
          timestamp DATETIME
        )
      `)

      await connection.execute(`
        CREATE TABLE IF NOT EXISTS anomaly_labels (
          event_id VARCHAR(64) PRIMARY KEY,
          is_anomalous TINYINT(1),
          anomaly_type VARCHAR(50)
        )
      `)

      await connection.execute(`
        CREATE TABLE IF NOT EXISTS otp_records (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          otp VARCHAR(6) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP NOT NULL,
          is_used TINYINT DEFAULT 0,
          purpose VARCHAR(20) DEFAULT 'login',
          FOREIGN KEY (user_id) REFERENCES users(user_id)
        )
      `)

      await connection.execute(`
        CREATE TABLE IF NOT EXISTS staff_alerts (
          id INT AUTO_INCREMENT PRIMARY KEY,
          event_id VARCHAR(36) NOT NULL,
          alert_type VARCHAR(50) NOT NULL,
          user_id VARCHAR(36) NOT NULL,
          message TEXT NOT NULL,
          is_resolved TINYINT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          resolved_at TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(user_id)
        )
      `)

      console.log("Tables created successfully")

      // Check if test users already exist
      const [existingUsers] = await connection.execute("SELECT * FROM users WHERE phone_number = ?", ["+918754562505"])

      if ((existingUsers as any[]).length === 0) {
        console.log("Creating test users...")

        // Create test users
        const userId1 = uuidv4()
        const userId2 = uuidv4()

        // Hash password - using the password provided by the user
        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash("itsBady7", salt)

        // Generate TOTP secrets
        const totpSecret1 = generateTOTPSecret()
        const totpSecret2 = generateTOTPSecret()

        // Insert test users
        await connection.execute(
          `INSERT INTO users 
          (user_id, full_name, phone_number, email, password_hash, totp_secret, is_verified) 
          VALUES (?, ?, ?, ?, ?, ?, 1)`,
          [userId1, "John Doe", "+918754562505", "john@example.com", hashedPassword, totpSecret1],
        )

        await connection.execute(
          `INSERT INTO users 
          (user_id, full_name, phone_number, email, password_hash, totp_secret, is_verified) 
          VALUES (?, ?, ?, ?, ?, ?, 1)`,
          [userId2, "Jane Smith", "+919876543211", "jane@example.com", hashedPassword, totpSecret2],
        )

        console.log("Test users created successfully")

        // Check if test accounts already exist
        const [existingAccounts] = await connection.execute("SELECT * FROM accounts WHERE account_id = ?", [
          "ACC123456",
        ])

        if ((existingAccounts as any[]).length === 0) {
          console.log("Creating test accounts...")

          // Insert test accounts
          await connection.execute(
            `INSERT INTO accounts 
            (account_id, user_id, account_type, account_name, initial_balance) 
            VALUES (?, ?, ?, ?, ?)`,
            ["ACC123456", userId1, "savings", "Primary Savings", 50000.0],
          )

          await connection.execute(
            `INSERT INTO accounts 
            (account_id, user_id, account_type, account_name, initial_balance) 
            VALUES (?, ?, ?, ?, ?)`,
            ["ACC123457", userId1, "current", "Business Account", 100000.0],
          )

          await connection.execute(
            `INSERT INTO accounts 
            (account_id, user_id, account_type, account_name, initial_balance) 
            VALUES (?, ?, ?, ?, ?)`,
            ["ACC789012", userId2, "savings", "Personal Savings", 75000.0],
          )

          // Insert accounts for new signups (without user_id)
          await connection.execute(
            `INSERT INTO accounts 
            (account_id, account_type, account_name, initial_balance) 
            VALUES (?, ?, ?, ?)`,
            ["ACC555555", "savings", "New Test Account 1", 25000.0],
          )

          await connection.execute(
            `INSERT INTO accounts 
            (account_id, account_type, account_name, initial_balance) 
            VALUES (?, ?, ?, ?)`,
            ["ACC666666", "current", "New Test Account 2", 35000.0],
          )

          console.log("Test accounts created successfully")

          // Insert sample transactions
          await connection.execute(
            `INSERT INTO transactions 
            (transaction_id, from_account_id, to_account_id, transaction_amount, transaction_timestamp,
            from_balance_before, from_balance_after, to_balance_before, to_balance_after) 
            VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?)`,
            ["TXN123", "ACC123456", "ACC789012", 1000.0, 51000.0, 50000.0, 74000.0, 75000.0],
          )

          await connection.execute(
            `INSERT INTO transactions 
            (transaction_id, from_account_id, to_account_id, transaction_amount, transaction_timestamp,
            from_balance_before, from_balance_after, to_balance_before, to_balance_after) 
            VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?)`,
            ["TXN124", "ACC789012", "ACC123456", 500.0, 75500.0, 75000.0, 49500.0, 50000.0],
          )

          await connection.execute(
            `INSERT INTO transactions 
            (transaction_id, from_account_id, to_account_id, transaction_amount, transaction_timestamp,
            from_balance_before, from_balance_after, to_balance_before, to_balance_after) 
            VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?)`,
            ["TXN125", "ACC123457", "ACC123456", 2000.0, 102000.0, 100000.0, 48000.0, 50000.0],
          )

          console.log("Sample transactions created successfully")
        } else {
          console.log("Test accounts already exist")
        }
      } else {
        console.log("Test users already exist")
      }

      // Commit transaction
      await connection.commit()

      return NextResponse.json({
        success: true,
        message: "Database initialized successfully",
        testCredentials: {
          login: [
            {
              accountId: "ACC123456",
              phoneNumber: "+918754562505",
              password: "itsBady7",
            },
            {
              accountId: "ACC789012",
              phoneNumber: "+919876543211",
              password: "itsBady7",
            },
          ],
          signup: [
            {
              accountNumber: "ACC555555",
              accountType: "savings",
              phoneNumber: "+918754562505",
              password: "itsBady7",
            },
            {
              accountNumber: "ACC666666",
              accountType: "current",
              phoneNumber: "+918754562505",
              password: "itsBady7",
            },
          ],
        },
      })
    } catch (error) {
      // Rollback transaction in case of error
      await connection.rollback()
      console.error("Database initialization error:", error)
      throw error
    } finally {
      connection.release()
    }
  } catch (error) {
    console.error("Database initialization error:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Database initialization failed",
        error: error.message || "Internal server error",
      },
      { status: 500 },
    )
  }
}
