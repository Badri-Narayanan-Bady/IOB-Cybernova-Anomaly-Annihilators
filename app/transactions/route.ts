import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

export async function GET() {
  let connection;
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: parseInt(process.env.DB_PORT || '3306'),
    });

    connection = await pool.getConnection();

    // Fetch transactions with account details
    const [rows] = await connection.execute(`
      SELECT 
        t.*,
        fa.account_name as from_account_name,
        ta.account_name as to_account_name,
        al.is_anomalous,
        al.anomaly_type
      FROM transactions t
      LEFT JOIN accounts fa ON t.from_account_id = fa.account_id
      LEFT JOIN accounts ta ON t.to_account_id = ta.account_id
      LEFT JOIN anomaly_labels al ON t.transaction_id = al.event_id
      WHERE t.from_account_id = ? OR t.to_account_id = ?
      ORDER BY t.transaction_timestamp DESC
    `, ['123456789012', '123456789012']); // Replace with actual account IDs

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.release();
  }
}