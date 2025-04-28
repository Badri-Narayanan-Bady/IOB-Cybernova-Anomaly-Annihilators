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
    const { accountId, phoneNumber } = await request.json()

    // Validate input
    if (!accountId || !phoneNumber) {
      return NextResponse.json({ message: "Account ID and phone number are required" }, { status: 400 })
    }

    // Get connection from pool
    const connection = await pool.getConnection()

    try {
      // Check if account exists and belongs to the user with the given phone number
      const [accountResult] = await connection.execute(
        `SELECT a.account_id, a.account_type, a.account_name, a.initial_balance, u.phone_number,
         (SELECT SUM(
           CASE 
             WHEN t.from_account_id = a.account_id THEN -t.transaction_amount 
             WHEN t.to_account_id = a.account_id THEN t.transaction_amount
             ELSE 0
           END
         ) FROM transactions t 
         WHERE t.from_account_id = a.account_id OR t.to_account_id = a.account_id) as transaction_balance
         FROM accounts a
         LEFT JOIN users u ON a.user_id = u.user_id
         WHERE a.account_id = ?`,
        [accountId],
      )

      const accounts = accountResult as any[]

      if (accounts.length === 0) {
        return NextResponse.json({ message: "Account not found. Please check your account number." }, { status: 404 })
      }

      const account = accounts[0]

      // For accounts that are registered to a user, verify phone number
      if (account.phone_number && account.phone_number !== phoneNumber) {
        return NextResponse.json(
          { message: "Invalid credentials. Please check your account number and phone number." },
          { status: 401 },
        )
      }

      // Calculate balance (initial balance + sum of transactions)
      const initialBalance = account.initial_balance || 0
      const transactionBalance = account.transaction_balance || 0
      const totalBalance = initialBalance + transactionBalance

      // Log the balance check
      await connection.execute(
        `INSERT INTO activity_log 
        (event_id, user_id, event_type, timestamp) 
        VALUES (UUID(), IFNULL((SELECT user_id FROM accounts WHERE account_id = ?), 'guest'), 'balance_check', NOW())`,
        [accountId],
      )

      return NextResponse.json({
        accountId: account.account_id,
        accountName: account.account_name,
        accountType: account.account_type,
        balance: totalBalance,
      })
    } finally {
      connection.release()
    }
  } catch (error) {
    console.error("Balance check error:", error)
    return NextResponse.json(
      {
        message: error.message || "Internal server error",
        error: process.env.NODE_ENV === "development" ? error.toString() : undefined,
      },
      { status: 500 },
    )
  }
}
