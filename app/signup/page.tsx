"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from "react-bootstrap"
import PhoneInput from "react-phone-input-2"
import "react-phone-input-2/lib/style.css"
import AnomalyDetectionScanner from "@/components/anomaly-detection-scanner"
import IOBLogo from "@/components/iob-logo"
import BehavioralMetricsVisualizer from "@/components/behavioral-metrics-visualizer"

export default function SignupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Get pre-filled data from URL if coming from login page
  const prefillAccountId = searchParams.get("accountId") || ""
  const prefillPhoneNumber = searchParams.get("phoneNumber") || ""

  const [accountNumber, setAccountNumber] = useState(prefillAccountId)
  const [fullName, setFullName] = useState("")
  const [phoneNumber, setPhoneNumber] = useState(prefillPhoneNumber)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [accountType, setAccountType] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Behavioral metrics
  const [typingSpeed, setTypingSpeed] = useState(0)
  const [cursorMovements, setCursorMovements] = useState(0)
  const [lastKeyTime, setLastKeyTime] = useState<number | null>(null)
  const [keyPressCount, setKeyPressCount] = useState(0)
  const [signupStartTime, setSignupStartTime] = useState<number | null>(null)
  const [keystrokeTimings, setKeystrokeTimings] = useState<number[]>([])
  const [showMetrics, setShowMetrics] = useState(false)

  const [location, setLocation] = useState<{ latitude: number | null; longitude: number | null }>({
    latitude: null,
    longitude: null,
  })
  const [isScanning, setIsScanning] = useState(false)
  const [anomalyDetected, setAnomalyDetected] = useState<boolean | null>(null)

  // Initialize signup session tracking
  useEffect(() => {
    setSignupStartTime(Date.now())

    // Track mouse movements
    const handleMouseMove = () => {
      setCursorMovements((prev) => prev + 1)
    }

    window.addEventListener("mousemove", handleMouseMove)

    // Get user's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          })
        },
        (error) => {
          console.error("Error getting location:", error)
        },
      )
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
    }
  }, [])

  // Track typing speed and keystroke timings
  const handleKeyPress = () => {
    const currentTime = Date.now()

    if (lastKeyTime) {
      const timeDiff = currentTime - lastKeyTime

      // Update keystroke timings array
      setKeystrokeTimings((prev) => [...prev, timeDiff])

      // Update running average of typing speed
      setTypingSpeed((prev) => {
        const newCount = keyPressCount + 1
        return (prev * keyPressCount + 1000 / timeDiff) / newCount
      })
      setKeyPressCount((prev) => prev + 1)
    }

    setLastKeyTime(currentTime)
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setIsScanning(true)
    setAnomalyDetected(null)

    // Validate form
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      setLoading(false)
      setIsScanning(false)
      return
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long")
      setLoading(false)
      setIsScanning(false)
      return
    }

    if (!phoneNumber) {
      setError("Please enter a valid phone number with country code")
      setLoading(false)
      setIsScanning(false)
      return
    }

    try {
      // Calculate session duration in seconds
      const sessionDuration = signupStartTime ? Math.floor((Date.now() - signupStartTime) / 1000) : 0

      // Send signup request to API with behavioral metrics
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accountNumber,
          fullName,
          phoneNumber,
          email,
          password,
          accountType,
          location: {
            latitude: location.latitude,
            longitude: location.longitude,
          },
          behavioralMetrics: {
            typingSpeed,
            cursorMovements,
            sessionDuration,
            keystrokeTimings,
            keyPressCount,
          },
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Signup failed")
      }

      // Signup successful, no anomalies
      setAnomalyDetected(false)

      // Continue with normal flow after scanning completes
      setTimeout(() => {
        // Redirect to OTP verification page
        router.push(`/verify-otp?phone=${phoneNumber}&action=signup&userId=${data.userId}`)
      }, 2000)
    } catch (err: any) {
      setError(err.message || "An error occurred during signup")
      setIsScanning(false)
    } finally {
      setLoading(false)
    }
  }

  const handleScanComplete = () => {
    setIsScanning(false)
  }

  return (
    <Container fluid className="min-vh-100 d-flex align-items-center justify-content-center bg-gradient-primary py-5">
      <Row className="justify-content-center w-100">
        <Col xs={12} md={8} lg={6} xl={5}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="text-center mb-4">
              <IOBLogo size="large" />
              <p className="text-white mt-2">Create your Internet Banking Account</p>
            </div>

            {isScanning || anomalyDetected !== null ? (
              <Card className="border-0 shadow-lg">
                <Card.Body className="p-4">
                  <AnomalyDetectionScanner
                    isScanning={isScanning}
                    anomalyDetected={anomalyDetected}
                    anomalyType={null}
                    onComplete={handleScanComplete}
                  />
                </Card.Body>
              </Card>
            ) : (
              <>
                <Card className="border-0 shadow-lg">
                  <Card.Body className="p-4">
                    <Card.Title className="text-center mb-4 fw-bold text-primary fs-4">Sign Up</Card.Title>

                    {error && (
                      <Alert variant="danger" className="mb-4">
                        <Alert.Heading>Error</Alert.Heading>
                        <p>{error}</p>
                      </Alert>
                    )}

                    <Form onSubmit={handleSignup}>
                      <Form.Group className="mb-3">
                        <Form.Label className="fw-bold">Account Number</Form.Label>
                        <Form.Control
                          type="text"
                          placeholder="Enter your IOB account number"
                          value={accountNumber}
                          onChange={(e) => setAccountNumber(e.target.value)}
                          onKeyDown={handleKeyPress}
                          required
                          className="py-2"
                        />
                        <Form.Text className="text-muted">
                          Enter your existing IOB account number (e.g., ACC555555)
                        </Form.Text>
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label className="fw-bold">Account Type</Form.Label>
                        <Form.Select
                          value={accountType}
                          onChange={(e) => setAccountType(e.target.value)}
                          required
                          className="py-2"
                        >
                          <option value="">Select account type</option>
                          <option value="savings">Savings Account</option>
                          <option value="current">Current Account</option>
                          <option value="fixed_deposit">Fixed Deposit</option>
                        </Form.Select>
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label className="fw-bold">Full Name</Form.Label>
                        <Form.Control
                          type="text"
                          placeholder="Enter your full name"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          onKeyDown={handleKeyPress}
                          required
                          className="py-2"
                        />
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label className="fw-bold">Phone Number (with country code)</Form.Label>
                        <PhoneInput
                          country={"in"}
                          value={phoneNumber.replace(/^\+/, "")}
                          onChange={(phone) => setPhoneNumber("+" + phone)}
                          inputProps={{
                            required: true,
                            onKeyDown: handleKeyPress,
                          }}
                          containerClass="w-100"
                          inputClass="form-control w-100 py-2"
                        />
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label className="fw-bold">Email (Optional)</Form.Label>
                        <Form.Control
                          type="email"
                          placeholder="Enter your email address"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          onKeyDown={handleKeyPress}
                          className="py-2"
                        />
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label className="fw-bold">Password</Form.Label>
                        <Form.Control
                          type="password"
                          placeholder="Create a password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          onKeyDown={handleKeyPress}
                          required
                          className="py-2"
                        />
                        <Form.Text className="text-muted">Password must be at least 8 characters long</Form.Text>
                      </Form.Group>

                      <Form.Group className="mb-4">
                        <Form.Label className="fw-bold">Confirm Password</Form.Label>
                        <Form.Control
                          type="password"
                          placeholder="Confirm your password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          onKeyDown={handleKeyPress}
                          required
                          className="py-2"
                        />
                      </Form.Group>

                      <div className="d-grid gap-2">
                        <Button type="submit" variant="primary" size="lg" disabled={loading} className="mb-3 py-2">
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
                              Processing...
                            </>
                          ) : (
                            "Sign Up"
                          )}
                        </Button>
                      </div>
                    </Form>
                  </Card.Body>
                  <Card.Footer className="bg-white border-0 p-4 pt-0">
                    <div className="d-flex justify-content-between mb-3">
                      <Link href="/login" className="text-decoration-none text-primary fw-bold">
                        Back to Login
                      </Link>
                      <Button
                        variant="link"
                        className="text-decoration-none text-primary fw-bold p-0"
                        onClick={() => setShowMetrics(!showMetrics)}
                      >
                        {showMetrics ? "Hide Metrics" : "Show Security Metrics"}
                      </Button>
                    </div>
                  </Card.Footer>
                </Card>

                {showMetrics && (
                  <div className="mt-4">
                    <BehavioralMetricsVisualizer
                      typingSpeed={typingSpeed}
                      cursorMovements={cursorMovements}
                      sessionDuration={signupStartTime ? Math.floor((Date.now() - signupStartTime) / 1000) : 0}
                      keystrokeTimings={keystrokeTimings}
                    />
                  </div>
                )}
              </>
            )}
          </motion.div>
        </Col>
      </Row>
    </Container>
  )
}
