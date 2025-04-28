"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { Container, Row, Col, Card, Form, Button, Alert, Spinner, ProgressBar } from "react-bootstrap"
import { getRemainingOTPTime } from "@/lib/otp-service"

export default function VerifyOTPPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const phoneNumber = searchParams.get("phone")
  const action = searchParams.get("action") || "login"
  const userId = searchParams.get("userId")

  const [otp, setOtp] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [verified, setVerified] = useState(false)
  const [timeLeft, setTimeLeft] = useState(getRemainingOTPTime())
  const [progress, setProgress] = useState(100)
  const maxTime = 60 // 1 minute in seconds

  useEffect(() => {
    if (!verified) {
      const timer = setInterval(() => {
        const remaining = getRemainingOTPTime()
        setTimeLeft(remaining)
        setProgress((remaining / maxTime) * 100)

        if (remaining <= 0) {
          // Force refresh when OTP expires
          alert("Your verification code has expired. A new code has been generated.")

          // Request a new OTP automatically
          handleResendOTP()
        }
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [verified])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      if (otp.length !== 6 || !/^\d+$/.test(otp)) {
        throw new Error("Please enter a valid 6-digit code")
      }

      // Send verification request to API
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phoneNumber,
          otp,
          action,
          userId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Verification failed")
      }

      // Mark as verified
      setVerified(true)

      // Redirect after a short delay
      setTimeout(() => {
        router.push(`/transfer?phone=${phoneNumber}&action=signup&userId=${data.userId}`)
      }, 2000)
    } catch (err: any) {
      setError(err.message || "Verification failed")
    } finally {
      setLoading(false)
    }
  }

  const handleResendOTP = async () => {
    setLoading(true)
    setError("")

    try {
      // Send request to resend OTP
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phoneNumber,
          action,
          userId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Failed to resend OTP")
      }

      // Reset timer
      setTimeLeft(getRemainingOTPTime())
      setProgress(100)

      alert("A new verification code has been sent to your phone.")
    } catch (err: any) {
      setError(err.message || "Failed to resend OTP")
    } finally {
      setLoading(false)
    }
  }

  if (!phoneNumber) {
    return (
      <Container fluid className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
        <Row className="justify-content-center w-100">
          <Col xs={12} md={6} lg={5} xl={4}>
            <Card className="border-0 shadow-sm">
              <Card.Body className="p-4">
                <Card.Title className="text-center mb-4">Error</Card.Title>
                <Alert variant="danger">
                  <Alert.Heading>Invalid Request</Alert.Heading>
                  <p>Missing phone number parameter.</p>
                </Alert>
                <div className="d-grid gap-2 mt-4">
                  <Button variant="primary" onClick={() => router.push("/login")}>
                    Return to Login
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    )
  }

  return (
    <Container fluid className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
      <Row className="justify-content-center w-100">
        <Col xs={12} md={6} lg={5} xl={4}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="text-center mb-4">
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 15 }}
              >
                <img
                  src="/placeholder.svg?height=80&width=80"
                  alt="IOB Logo"
                  className="mb-3"
                  style={{ maxHeight: "80px" }}
                />
              </motion.div>
              <h1 className="fw-bold text-primary">Indian Overseas Bank</h1>
              <p className="text-muted">Verify Your Identity</p>
            </div>

            <Card className="border-0 shadow-sm">
              <Card.Body className="p-4">
                <Card.Title className="text-center mb-4 fw-bold">OTP Verification</Card.Title>

                {verified ? (
                  <div className="text-center py-4">
                    <div className="success-icon bg-success text-white rounded-circle p-3 d-inline-flex mb-3">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="32"
                        height="32"
                        fill="currentColor"
                        className="bi bi-check-lg"
                        viewBox="0 0 16 16"
                      >
                        <path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425a.247.247 0 0 1 .02-.022Z" />
                      </svg>
                    </div>
                    <h4 className="fw-bold text-success mb-3">Verification Successful</h4>
                    <p className="text-muted">
                      {action === "signup"
                        ? "Your account has been created successfully."
                        : "Your identity has been verified successfully."}
                    </p>
                    <p className="text-muted">Redirecting you shortly...</p>
                    <Spinner animation="border" variant="primary" className="mt-3" />
                  </div>
                ) : (
                  <>
                    <p className="text-center text-muted mb-4">
                      {action === "signup"
                        ? "We've sent a verification code to your phone to complete your registration."
                        : "We've sent a verification code to your phone to verify your identity."}
                    </p>

                    <div className="mb-4">
                      <p className="text-center fw-bold mb-2">
                        Code sent to <span className="text-primary">{phoneNumber}</span>
                      </p>
                      <div className="mt-3">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span className="text-muted small">Code expires in:</span>
                          <span className="fw-bold">{formatTime(timeLeft)}</span>
                        </div>
                        <ProgressBar
                          now={progress}
                          variant={progress < 30 ? "danger" : progress < 70 ? "warning" : "success"}
                          animated
                        />
                      </div>
                    </div>

                    {error && (
                      <Alert variant="danger" className="mb-4">
                        <Alert.Heading>Error</Alert.Heading>
                        <p>{error}</p>
                      </Alert>
                    )}

                    <Form onSubmit={handleVerify}>
                      <Form.Group className="mb-4">
                        <Form.Label>Verification Code</Form.Label>
                        <Form.Control
                          type="text"
                          placeholder="Enter 6-digit code"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value)}
                          maxLength={6}
                          required
                          className="form-control-lg text-center"
                          style={{ letterSpacing: "0.5em", fontWeight: "bold" }}
                        />
                      </Form.Group>

                      <div className="d-grid gap-2">
                        <Button type="submit" variant="primary" size="lg" disabled={loading}>
                          {loading ? (
                            <>
                              <Spinner
                                as="span"
                                animation="border"
                                size="sm"
                                role="status"
                                aria-hidden="true"
                                className="me-2"
                              />
                              Verifying...
                            </>
                          ) : (
                            "Verify Code"
                          )}
                        </Button>
                      </div>
                    </Form>
                  </>
                )}
              </Card.Body>
              {!verified && (
                <Card.Footer className="bg-white border-0 p-4 pt-0 text-center">
                  <Button
                    variant="link"
                    className="text-decoration-none p-0"
                    onClick={handleResendOTP}
                    disabled={loading}
                  >
                    Didn't receive the code? Resend
                  </Button>
                </Card.Footer>
              )}
            </Card>
          </motion.div>
        </Col>
      </Row>
    </Container>
  )
}
