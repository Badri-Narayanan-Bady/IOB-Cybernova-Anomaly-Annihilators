"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from "react-bootstrap"
import PhoneInput from "react-phone-input-2"
import "react-phone-input-2/lib/style.css"
import AnomalyDetectionScanner from "@/components/anomaly-detection-scanner"
import StaffAlertService from "@/components/staff-alert-service"
import IOBLogo from "@/components/iob-logo"
import BehavioralMetricsVisualizer from "@/components/behavioral-metrics-visualizer"
import AuthenticatorQR from "@/components/authenticator-qr"

export default function LoginPage() {
  const router = useRouter()
  const [accountId, setAccountId] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [needsSignup, setNeedsSignup] = useState(false)
  const [showTOTP, setShowTOTP] = useState(false)
  const [totpCode, setTotpCode] = useState("")
  const [showQR, setShowQR] = useState(false)
  const [userId, setUserId] = useState("")
  const [accountName, setAccountName] = useState("")

  // Behavioral metrics
  const [typingSpeed, setTypingSpeed] = useState(0)
  const [cursorMovements, setCursorMovements] = useState(0)
  const [lastKeyTime, setLastKeyTime] = useState<number | null>(null)
  const [keyPressCount, setKeyPressCount] = useState(0)
  const [loginStartTime, setLoginStartTime] = useState<number | null>(null)
  const [keystrokeTimings, setKeystrokeTimings] = useState<number[]>([])
  const [showMetrics, setShowMetrics] = useState(false)

  const [location, setLocation] = useState<{ latitude: number | null; longitude: number | null }>({
    latitude: null,
    longitude: null,
  })
  const [isScanning, setIsScanning] = useState(false)
  const [anomalyDetected, setAnomalyDetected] = useState<boolean | null>(null)
  const [anomalyType, setAnomalyType] = useState<string | null>(null)
  const [eventId, setEventId] = useState<string | null>(null)

  // Initialize login session tracking
  useEffect(() => {
    setLoginStartTime(Date.now())

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setNeedsSignup(false)
    setIsScanning(true)
    setAnomalyDetected(null)
    setAnomalyType(null)

    try {
      // Calculate session duration in seconds
      const sessionDuration = loginStartTime ? Math.floor((Date.now() - loginStartTime) / 1000) : 0

      // Determine login time of day
      const hour = new Date().getHours()
      let loginTimeOfDay = "morning"
      if (hour >= 12 && hour < 17) loginTimeOfDay = "afternoon"
      else if (hour >= 17) loginTimeOfDay = "evening"

      // Prepare login data with enhanced behavioral metrics
      const loginData = {
        accountId,
        phoneNumber,
        password,
        behavioralMetrics: {
          typingSpeed,
          cursorMovements,
          sessionDuration,
          keystrokeTimings,
          keyPressCount,
          latitude: location.latitude,
          longitude: location.longitude,
          loginTimeOfDay,
        },
      }

      // Send login request to API
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(loginData),
      })

      const data = await response.json()

      if (!response.ok) {
        // Check if user needs to sign up
        if (response.status === 404 && data.needsSignup) {
          setNeedsSignup(true)
          throw new Error("Account not found. Please sign up to create an account.")
        }
        throw new Error(data.message || "Login failed")
      }

      // Store event ID and user ID for alerts
      setEventId(data.eventId || null)
      setUserId(data.userId || "")
      setAccountName(data.accountName || "")

      // Check if anomaly was detected
      if (data.anomalyDetected) {
        setAnomalyDetected(true)
        setAnomalyType(data.anomalyType || "Suspicious login activity")
        setTimeout(() => {
          // Redirect to OTP verification page
          router.push(`/verify-otp?phone=${phoneNumber}&action=signup&userId=${data.userId}`)
        }, 2000)
      } else {
        setAnomalyDetected(false)
      // changed
      // Continue with normal flow after scanning completes
        setTimeout(() => {
          // Redirect to OTP verification page
          router.push(`/transfer?phone=${phoneNumber}&action=signup&userId=${data.userId}`)
        }, 2000)
      }

      // Check if user has TOTP set up
      if (data.hasTOTP) {
        // Show TOTP input field
        setIsScanning(false)
        setShowTOTP(true)
      } else {
        // Show QR code for setting up TOTP
        setIsScanning(false)
        setShowQR(true)
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during login")
      setIsScanning(false)
    } finally {
      setLoading(false)
    }
  }

  const handleTOTPVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      // Send TOTP verification request
      const response = await fetch("/api/auth/verify-totp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          accountId,
          totpCode,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "TOTP verification failed")
      }

      // TOTP verified successfully, redirect to transfer
      router.push("/transfer") //changed from dashboard to transfer
    } catch (err: any) {
      setError(err.message || "An error occurred during verification")
    } finally {
      setLoading(false)
    }
  }

  const handleRedirectToSignup = () => {
    // Pass the entered account ID and phone number to the signup page
    router.push(`/signup?accountId=${accountId}&phoneNumber=${encodeURIComponent(phoneNumber)}`)
  }

  const handleScanComplete = () => {
    setIsScanning(false)
  }

  const handleQRComplete = () => {
    // After QR code is scanned, show TOTP input
    setShowQR(false)
    setShowTOTP(true)
  }

  return (
    <Container fluid className="min-vh-100 d-flex align-items-center justify-content-center bg-gradient-primary py-5">
      <Row className="justify-content-center w-100">
        <Col xs={12} md={8} lg={6} xl={5}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="text-center mb-4">
              <IOBLogo size="large" />
              <p className="text-white mt-2">Secure Internet Banking Login</p>
            </div>

            {isScanning || anomalyDetected !== null ? (
              <Card className="border-0 shadow-lg">
                <Card.Body className="p-4">
                  <AnomalyDetectionScanner
                    isScanning={isScanning}
                    anomalyDetected={anomalyDetected}
                    anomalyType={anomalyType}
                    onComplete={handleScanComplete}
                  />

                  {/* Staff alert service - only renders when anomaly is detected */}
                  {anomalyDetected && (
                    <StaffAlertService
                      eventId={eventId || undefined}
                      userId={userId || undefined}
                      alertType="login_anomaly"
                      message={anomalyType || "Suspicious login attempt detected"}
                      isAnomaly={anomalyDetected}
                    />
                  )}
                </Card.Body>
              </Card>
            ) : showQR ? (
              <AuthenticatorQR
                userId={userId}
                accountId={accountId}
                accountName={accountName}
                onComplete={handleQRComplete}
              />
            ) : showTOTP ? (
              <Card className="border-0 shadow-lg">
                <Card.Body className="p-4">
                  <Card.Title className="text-center mb-4 fw-bold text-primary fs-4">
                    Enter Authentication Code
                  </Card.Title>

                  {error && (
                    <Alert variant="danger" className="mb-4">
                      <Alert.Heading>Error</Alert.Heading>
                      <p>{error}</p>
                    </Alert>
                  )}

                  <Form onSubmit={handleTOTPVerify}>
                    <Form.Group className="mb-4">
                      <Form.Label className="fw-bold">Authentication Code</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="Enter 6-digit code from IOB Authenticator app"
                        value={totpCode}
                        onChange={(e) => setTotpCode(e.target.value)}
                        required
                        className="py-2 text-center form-control-lg"
                        maxLength={6}
                      />
                      <Form.Text className="text-muted">
                        Open the IOB Authenticator app to get your verification code
                      </Form.Text>
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
            ) : (
              <>
                <Card className="border-0 shadow-lg">
                  <Card.Body className="p-4">
                    <Card.Title className="text-center mb-4 fw-bold text-primary fs-4">
                      Login to Your Account
                    </Card.Title>

                    {error && (
                      <Alert variant={needsSignup ? "warning" : "danger"} className="mb-4">
                        <Alert.Heading>{needsSignup ? "Account Not Found" : "Error"}</Alert.Heading>
                        <p>{error}</p>
                        {needsSignup && (
                          <div className="d-grid gap-2">
                            <Button onClick={handleRedirectToSignup} variant="primary" className="mt-2">
                              Sign Up Now
                            </Button>
                          </div>
                        )}
                      </Alert>
                    )}

                    <Form onSubmit={handleLogin}>
                      <Form.Group className="mb-3">
                        <Form.Label className="fw-bold">Account ID</Form.Label>
                        <Form.Control
                          type="text"
                          placeholder="Enter your account ID"
                          value={accountId}
                          onChange={(e) => setAccountId(e.target.value)}
                          onKeyDown={handleKeyPress}
                          required
                          className="py-2"
                        />
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label className="fw-bold">Phone Number</Form.Label>
                        <PhoneInput
                          country={"in"}
                          value={phoneNumber}
                          onChange={(phone) => setPhoneNumber("+" + phone)}
                          inputProps={{
                            required: true,
                            onKeyDown: handleKeyPress,
                          }}
                          containerClass="w-100"
                          inputClass="form-control w-100 py-2"
                          disableCountryCode={false}
                          disableDropdown={false}
                          enableSearch={true}
                          countryCodeEditable={false}
                        />
                      </Form.Group>

                      <Form.Group className="mb-4">
                        <Form.Label className="fw-bold">Password</Form.Label>
                        <Form.Control
                          type="password"
                          placeholder="Enter your password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
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
                              Logging in...
                            </>
                          ) : (
                            "Login"
                          )}
                        </Button>
                      </div>
                    </Form>
                  </Card.Body>
                  <Card.Footer className="bg-white border-0 p-4 pt-0">
                    <div className="d-flex justify-content-between mb-3">
                      <Link href="/check-balance" className="text-decoration-none text-primary fw-bold">
                        Check Balance
                      </Link>
                      <Button
                        variant="link"
                        className="text-decoration-none text-primary fw-bold p-0"
                        onClick={() => setShowMetrics(!showMetrics)}
                      >
                        {showMetrics ? "Hide Metrics" : "Show Security Metrics"}
                      </Button>
                    </div>
                    <div className="text-center">
                      <p className="mb-0">
                        Don't have an account?{" "}
                        <Link href="/signup" className="text-decoration-none fw-bold text-primary">
                          Sign Up
                        </Link>
                      </p>
                    </div>
                  </Card.Footer>
                </Card>

                {showMetrics && (
                  <div className="mt-4">
                    <BehavioralMetricsVisualizer
                      typingSpeed={typingSpeed}
                      cursorMovements={cursorMovements}
                      sessionDuration={loginStartTime ? Math.floor((Date.now() - loginStartTime) / 1000) : 0}
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
