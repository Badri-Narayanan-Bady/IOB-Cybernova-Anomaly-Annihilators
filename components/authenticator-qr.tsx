"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { QRCodeSVG } from "qrcode.react"


import { generateTOTPSecret } from "@/lib/otp-service"

interface AuthenticatorQRProps {
  userId: string
  accountId: string
  accountName?: string
  onComplete?: () => void
}

export default function AuthenticatorQR({ userId, accountId, accountName, onComplete }: AuthenticatorQRProps) {
  const [secret, setSecret] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    // Generate a new TOTP secret if one doesn't exist
    const generateSecret = async () => {
      try {
        setLoading(true)
        // Generate a new secret
        const newSecret = generateTOTPSecret()
        setSecret(newSecret)
      } catch (err: any) {
        setError(err.message || "Failed to generate QR code")
      } finally {
        setLoading(false)
      }
    }

    generateSecret()
  }, [userId])

  const handleSaveSecret = async () => {
    try {
      setLoading(true)
      // Save the secret to the user's account
      const response = await fetch("/api/auth/save-totp-secret", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          totpSecret: secret,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to save TOTP secret")
      }

      setSaved(true)

      // Call onComplete callback if provided
      if (onComplete) {
        setTimeout(() => {
          onComplete()
        }, 2000)
      }
    } catch (err: any) {
      setError(err.message || "Failed to save TOTP secret")
    } finally {
      setLoading(false)
    }
  }

  // Generate the otpauth URL for the QR code
  const otpauthUrl = `otpauth://totp/IOB:${accountId}?secret=${secret}&issuer=IndianOverseasBank&algorithm=SHA1&digits=6&period=30`

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="text-center mb-2 fw-bold text-primary fs-4">Set Up Authenticator</CardTitle>
        <CardDescription className="text-center">
          Scan this QR code with the IOB Authenticator app to enable secure login
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center p-4">
        {error ? (
          <div className="bg-red-50 text-red-800 p-4 rounded-lg mb-4">
            <p className="font-bold">Error</p>
            <p>{error}</p>
          </div>
        ) : loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-800"></div>
          </div>
        ) : saved ? (
          <div className="bg-green-50 text-green-800 p-4 rounded-lg mb-4 text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-green-100 rounded-full p-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <p className="font-bold text-lg mb-2">Setup Complete!</p>
            <p>Your authenticator has been successfully set up.</p>
          </div>
        ) : (
          <>
            <div className="bg-white p-4 rounded-lg shadow-md mb-4">
            <QRCodeSVG value={otpauthUrl} size={200} level="H" includeMargin={true} />
            </div>
            <div className="w-full space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-800">
                  <span className="font-bold">Manual setup:</span> If you can't scan the QR code, enter this secret key
                  manually in your authenticator app:
                </p>
                <p className="font-mono bg-white p-2 rounded border mt-2 text-center select-all">{secret}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-600">1. Download the IOB Authenticator app from the Play Store</p>
                <p className="text-sm text-gray-600">2. Scan this QR code or enter the secret key manually</p>
                <p className="text-sm text-gray-600">3. Click "I've set up my authenticator" below</p>
              </div>
            </div>
          </>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        {!saved && (
          <>
            <Button variant="outline" onClick={onComplete}>
              Skip for now
            </Button>
            <Button onClick={handleSaveSecret} disabled={loading || saved}>
              {loading ? "Saving..." : "I've set up my authenticator"}
            </Button>
          </>
        )}
        {saved && (
          <Button className="w-full" onClick={onComplete}>
            Continue
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
