-- Create users table if not exists
CREATE TABLE IF NOT EXISTS users (
  user_id VARCHAR(36) PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(255),
  password_hash VARCHAR(255) NOT NULL,
  totp_secret VARCHAR(32),
  is_verified BOOLEAN DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  verified_at TIMESTAMP,
  last_login TIMESTAMP,
  last_latitude DECIMAL(10, 8),
  last_longitude DECIMAL(11, 8),
  UNIQUE INDEX idx_phone (phone_number)
);

-- Create accounts table if not exists
CREATE TABLE IF NOT EXISTS accounts (
  account_id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36),
  account_type ENUM('savings', 'current', 'fixed_deposit', 'loan') NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  initial_balance DECIMAL(15, 2) DEFAULT 10000.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Create transactions table if not exists
CREATE TABLE IF NOT EXISTS transactions (
  transaction_id VARCHAR(36) PRIMARY KEY,
  from_account_id VARCHAR(36) NOT NULL,
  to_account_id VARCHAR(36) NOT NULL,
  transaction_amount DECIMAL(15, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'INR',
  transaction_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  transaction_latitude DECIMAL(10, 8),
  transaction_longitude DECIMAL(11, 8),
  from_balance_before DECIMAL(15, 2),
  from_balance_after DECIMAL(15, 2),
  to_balance_before DECIMAL(15, 2),
  to_balance_after DECIMAL(15, 2),
  transaction_frequency INT,
  FOREIGN KEY (from_account_id) REFERENCES accounts(account_id),
  FOREIGN KEY (to_account_id) REFERENCES accounts(account_id)
);

-- Create activity_log table if not exists
CREATE TABLE IF NOT EXISTS activity_log (
  event_id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  typing_speed FLOAT,
  cursor_movements INT,
  session_duration INT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  login_time_of_day VARCHAR(20),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Create model_learning_logs table if not exists
CREATE TABLE IF NOT EXISTS model_learning_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id VARCHAR(36) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  features JSON NOT NULL,
  prediction TINYINT NOT NULL,
  score FLOAT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE INDEX idx_event_id (event_id)
);

-- Create anomaly_labels table if not exists
CREATE TABLE IF NOT EXISTS anomaly_labels (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id VARCHAR(36) NOT NULL,
  is_anomalous TINYINT NOT NULL DEFAULT 0,
  anomaly_type VARCHAR(100),
  UNIQUE INDEX idx_event_id (event_id)
);

-- Create OTP records table if not exists
CREATE TABLE IF NOT EXISTS otp_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  otp VARCHAR(6) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  is_used TINYINT DEFAULT 0,
  purpose VARCHAR(20) DEFAULT 'login',
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Create staff_alerts table for bank staff notifications
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
);

-- Clear existing test data to avoid conflicts
DELETE FROM otp_records;
DELETE FROM anomaly_labels;
DELETE FROM model_learning_logs;
DELETE FROM activity_log;
DELETE FROM transactions;
DELETE FROM accounts;
DELETE FROM users;

-- Insert sample data for testing
-- Password for both users is "Password123"
INSERT INTO users (user_id, full_name, phone_number, email, password_hash, is_verified, totp_secret)
VALUES 
  ('user123', 'John Doe', '+918754562505', 'john@example.com', '$2a$10$XFE/UQEjIhHfZBQQJ/YmKOGlpS2c4HjZn.JZO9aWaZHYBP5t.CKJa', 1, 'JBSWY3DPEHPK3PXP'),
  ('user456', 'Jane Smith', '+919876543211', 'jane@example.com', '$2a$10$XFE/UQEjIhHfZBQQJ/YmKOGlpS2c4HjZn.JZO9aWaZHYBP5t.CKJa', 1, 'KBSWY3DPEHPK3PXQ');

-- Insert sample accounts
INSERT INTO accounts (account_id, user_id, account_type, account_name, initial_balance)
VALUES 
  ('ACC123456', 'user123', 'savings', 'Primary Savings', 50000.00),
  ('ACC123457', 'user123', 'current', 'Business Account', 100000.00),
  ('ACC789012', 'user456', 'savings', 'Personal Savings', 75000.00);

-- Insert accounts for new signups (without user_id)
INSERT INTO accounts (account_id, account_type, account_name, initial_balance)
VALUES 
  ('ACC555555', 'savings', 'New Test Account 1', 25000.00),
  ('ACC666666', 'current', 'New Test Account 2', 35000.00);

-- Insert sample transactions
INSERT INTO transactions (transaction_id, from_account_id, to_account_id, transaction_amount, transaction_timestamp, from_balance_before, from_balance_after, to_balance_before, to_balance_after)
VALUES 
  ('TXN123', 'ACC123456', 'ACC789012', 1000.00, DATE_SUB(NOW(), INTERVAL 10 DAY), 51000.00, 50000.00, 74000.00, 75000.00),
  ('TXN124', 'ACC789012', 'ACC123456', 500.00, DATE_SUB(NOW(), INTERVAL 5 DAY), 75500.00, 75000.00, 49500.00, 50000.00),
  ('TXN125', 'ACC123457', 'ACC123456', 2000.00, DATE_SUB(NOW(), INTERVAL 2 DAY), 102000.00, 100000.00, 48000.00, 50000.00);
