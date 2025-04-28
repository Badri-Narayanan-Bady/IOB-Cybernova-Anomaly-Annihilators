import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { verifyTOTP } from "@/lib/otp-service"

export async function POST(request: Request) {
  try {
    const { userId, totpCode, transactionId, purpose = "login" } = await request.json()

    // Validate input
    if (!userId || !totpCode) {
      return NextResponse.json({ message: "User ID and TOTP code are required" }, { status: 400 })
    }

    // Get user's TOTP secret
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("totp_secret")
      .eq("user_id", userId)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ message: "User not found" }, { status: 404 })
    }

    const totpSecret = userData.totp_secret

    // Verify TOTP code
    const isValid = verifyTOTP(totpCode, totpSecret)

    if (!isValid) {
      return NextResponse.json({ message: "Invalid authentication code" }, { status: 400 })
    }

    // If this is for a transaction, update the transaction status
    if (purpose === "transaction" && transactionId) {
      // Mark transaction as verified
      const { error: updateError } = await supabase
        .from("transactions")
        .update({ verified: true })
        .eq("transaction_id", transactionId)

      if (updateError) {
        console.error("Failed to update transaction:", updateError)
      }
    }

    // Update last verification time
    const { error: updateError } = await supabase
      .from("users")
      .update({ last_verification: new Date().toISOString() })
      .eq("user_id", userId)

    if (updateError) {
      console.error("Failed to update user:", updateError)
    }

    // Return success response
    return NextResponse.json({
      message: "Authentication successful",
      userId,
      purpose,
    })
  } catch (error: any) {
    console.error("TOTP verification error:", error)
    return NextResponse.json(
      {
        message: error.message || "Internal server error",
        error: process.env.NODE_ENV === "development" ? error.toString() : undefined,
      },
      { status: 500 },
    )
  }
}
