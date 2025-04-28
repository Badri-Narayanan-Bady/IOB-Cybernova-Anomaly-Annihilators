"use client"

import type React from "react"

import { useState } from "react"
import { Card, Form, Button, Alert, Spinner } from "react-bootstrap"

interface TOTPVerificationProps {
  userId: string
  transactionId?: string
  onVerified: () => void
  onCancel: () => void
}

export default function TOTPVerification({ userId, transactionId, onVerified, onCancel }: TOTPVerificationProps) {
  const [totpCode, setTotpCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      // Validate TOTP code format
      if (totpCode.length !== 6 || !/^\d+$/.test(totpCode)) {
        throw new Error("Please enter a valid 6-digit code")
      }

      // Send verification request to API
      const response = await fetch("/api/auth/verify-totp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          totpCode,
          transactionId,
          purpose: transactionId ? "transaction" : "login",
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Verification failed")
      }

      // Call the onVerified callback
      onVerified()
    } catch (err: any) {
      setError(err.message || "An error occurred during verification")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-0 shadow-sm">
      <Card.Body className="p-4">
        <Card.Title className="text-center mb-4 fw-bold">Security Verification Required</Card.Title>

        <Alert variant="warning" className="mb-4">
          <Alert.Heading>Additional Verification Needed</Alert.Heading>
          <p>
            {transactionId
              ? "This transaction requires additional verification for security purposes."
              : "Please verify your identity to continue."}
          </p>
        </Alert>

        {error && (
          <Alert variant="danger" className="mb-4">
            <Alert.Heading>Error</Alert.Heading>
            <p>{error}</p>
          </Alert>
        )}

        <Form onSubmit={handleVerify}>
          <Form.Group className="mb-4">
            <Form.Label className="fw-bold">Authentication Code</Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter 6-digit code from IOB Authenticator app"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              maxLength={6}
              required
              className="form-control-lg text-center"
            />
            <Form.Text className="text-muted">Open the IOB Authenticator app to get your verification code</Form.Text>
          </Form.Group>

          <div className="d-flex justify-content-between">
            <Button variant="outline-secondary" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? (
                <>
                  <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                  Verifying...
                </>
              ) : (
                "Verify"
              )}
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  )
}
