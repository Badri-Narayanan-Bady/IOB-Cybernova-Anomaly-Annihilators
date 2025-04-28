/**
 * OTP Service for generating and verifying Time-based One-Time Passwords (TOTP)
 */
import crypto from "crypto"
import { customAlphabet } from "nanoid"

// TOTP Configuration
const TOTP_DIGITS = 6
const TOTP_STEP = 30 // 30 seconds validity
const TOTP_ALGORITHM = "sha1"
const TOTP_WINDOW = 1 // Allow 1 step before and after for clock drift

// Generate a secure random secret for TOTP
export function generateTOTPSecret(): string {
  // Generate a 32-character base32 secret
  const nanoid = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ234567", 32)
  return nanoid()
}

// Generate a time-based OTP using HMAC-SHA1
export function generateTOTP(secret: string): string {
  try {
    // Convert base32 secret to buffer
    const secretBuffer = base32ToBuffer(secret)

    // Get current time period (floor(current_unix_time / step))
    const counter = Math.floor(Date.now() / 1000 / TOTP_STEP)

    // Generate TOTP with the current counter
    return generateTOTPWithCounter(secretBuffer, counter)
  } catch (error) {
    console.error("Error generating TOTP:", error)
    // Fallback to simple OTP generation
    return generateSimpleOTP()
  }
}

// Verify a time-based OTP
export function verifyTOTP(token: string, secret: string): boolean {
  try {
    // Convert base32 secret to buffer
    const secretBuffer = base32ToBuffer(secret)

    // Get current time period
    const currentCounter = Math.floor(Date.now() / 1000 / TOTP_STEP)

    // Check current time period and window before/after for clock drift
    for (let i = -TOTP_WINDOW; i <= TOTP_WINDOW; i++) {
      const counter = currentCounter + i
      const expectedToken = generateTOTPWithCounter(secretBuffer, counter)
      if (token === expectedToken) {
        return true
      }
    }

    return false
  } catch (error) {
    console.error("TOTP verification error:", error)
    return false
  }
}

// Generate TOTP with a specific counter value
function generateTOTPWithCounter(secretBuffer: Buffer, counter: number): string {
  try {
    // Convert counter to buffer
    const counterBuffer = Buffer.alloc(8)
    for (let i = 0; i < 8; i++) {
      counterBuffer[7 - i] = (counter >> (i * 8)) & 0xff
    }

    // Generate HMAC-SHA1 hash
    const hmac = crypto.createHmac(TOTP_ALGORITHM, secretBuffer)
    hmac.update(counterBuffer)
    const digest = hmac.digest()

    // Dynamic truncation
    const offset = digest[digest.length - 1] & 0xf

    // Generate OTP value
    const binary =
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff)

    // Modulo to get the specified number of digits
    const otp = binary % Math.pow(10, TOTP_DIGITS)

    // Pad with leading zeros if necessary
    return otp.toString().padStart(TOTP_DIGITS, "0")
  } catch (error) {
    console.error("Error generating TOTP with counter:", error)
    return generateSimpleOTP()
  }
}

// Convert base32 string to buffer
function base32ToBuffer(base32: string): Buffer {
  const base32chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
  let bits = 0
  let value = 0
  const output = []

  for (let i = 0; i < base32.length; i++) {
    const charValue = base32chars.indexOf(base32.charAt(i).toUpperCase())
    if (charValue === -1) continue

    value = (value << 5) | charValue
    bits += 5

    if (bits >= 8) {
      output.push((value >> (bits - 8)) & 0xff)
      bits -= 8
    }
  }

  return Buffer.from(output)
}

// Generate a simple 6-digit OTP (fallback method)
function generateSimpleOTP(): string {
  // Generate a random 6-digit number
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Get remaining time for TOTP in seconds
export function getRemainingOTPTime(): number {
  const currentTime = Math.floor(Date.now() / 1000)
  const timeLeft = TOTP_STEP - (currentTime % TOTP_STEP)
  return timeLeft
}

// Validate phone number format
export function validatePhoneNumber(phoneNumber: string): boolean {
  // Basic validation for international phone numbers
  const phoneRegex = /^\+[1-9]\d{1,14}$/
  return phoneRegex.test(phoneNumber)
}

// Send OTP to the user's phone number via Twilio (mock implementation)
export async function sendOTP(phoneNumber: string, otp: string): Promise<boolean> {
  try {
    // Validate phone number
    if (!validatePhoneNumber(phoneNumber)) {
      throw new Error("Invalid phone number format")
    }

    console.log(`[OTP Service] Sending OTP ${otp} to ${phoneNumber}`)

    // Mock implementation for testing
    console.log(
      `[OTP Service] Message sent to ${phoneNumber}: Your IOB Banking verification code is: ${otp}. Valid for 30 seconds. Do not share this code with anyone.`,
    )

    return true
  } catch (error) {
    console.error("Error sending OTP:", error)
    return false
  }
}
