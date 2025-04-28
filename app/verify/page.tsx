"use client"

import type React from "react"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"

export default function VerifyPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [otp, setOtp] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Get transaction ID if this is a transaction verification
  const transactionId = searchParams.get("id")

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      // In a real app, this would verify the OTP with the backend
      // For demo purposes, we'll just accept any 6-digit code
      if (otp.length !== 6 || !/^\d+$/.test(otp)) {
        throw new Error("Please enter a valid 6-digit code")
      }

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // Redirect based on verification type
      if (transactionId) {
        router.push("/dashboard?verified=transaction")
      } else {
        router.push("/dashboard")
      }
    } catch (err: any) {
      setError(err.message || "Verification failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-800">Indian Overseas Bank</h1>
          <p className="text-gray-600">Additional Verification Required</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Security Verification</CardTitle>
            <CardDescription>
              {transactionId
                ? "We detected unusual activity with your transaction. Please verify your identity."
                : "We detected unusual login activity. Please verify your identity."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="warning" className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Security Alert</AlertTitle>
              <AlertDescription>
                {transactionId
                  ? "This transaction appears unusual compared to your normal patterns."
                  : "This login attempt appears unusual compared to your normal patterns."}
              </AlertDescription>
            </Alert>

            <form onSubmit={handleVerify}>
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp">Verification Code</Label>
                  <p className="text-sm text-gray-500 mb-2">
                    We've sent a 6-digit verification code to your registered mobile number.
                  </p>
                  <Input
                    id="otp"
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    maxLength={6}
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full mt-6 bg-blue-800 hover:bg-blue-700" disabled={loading}>
                {loading ? "Verifying..." : "Verify Identity"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button variant="link" className="px-0 text-blue-800">
              Didn't receive a code? Resend
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
