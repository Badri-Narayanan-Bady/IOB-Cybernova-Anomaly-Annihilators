"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from "react-bootstrap"
import AnomalyDetectionScanner from "@/components/anomaly-detection-scanner"
import StaffAlertService from "@/components/staff-alert-service"
import TOTPVerification from "@/components/totp-verification"

interface Account {
  account_id: string
  account_type: string
  account_name: string
  balance: number
}

export default function TransferPage() {
  const router = useRouter()
  const [account, setAccount] = useState<Account | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const [toAccount, setToAccount] = useState("")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [transferType, setTransferType] = useState("individual")
  const [location, setLocation] = useState<{ latitude: number | null; longitude: number | null }>({
    latitude: null,
    longitude: null,
  })

  // Behavioral metrics for anomaly detection
  const [transferStartTime, setTransferStartTime] = useState<number>(Date.now())
  const [cursorMovements, setCursorMovements] = useState(0)

  // Anomaly detection states
  const [isScanning, setIsScanning] = useState(false)
  const [anomalyDetected, setAnomalyDetected] = useState<boolean | null>(null)
  const [anomalyType, setAnomalyType] = useState<string | null>(null)
  const [eventId, setEventId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  // TOTP verification
  const [showTOTP, setShowTOTP] = useState(false)
  const [transactionData, setTransactionData] = useState<any>(null)

  useEffect(() => {
    const fetchAccount = async () => {
      try {
        // Get current user from session (MySQL-based auth)
        const res = await fetch("/api/auth/session")
        const session = await res.json()
        console.log(session)
        if (!session?.user) {
          router.push("/login")
          return
        }
        setUserId(session.user.user_id)

        // Fetch the user's account from MySQL API
        const accRes = await fetch(`/api/accounts/get?userId=${session.user.user_id}`)
        const accData = await accRes.json()
        if (!accRes.ok || !accData.account) throw new Error(accData.message || "Account not found")
        setAccount(accData.account)
      } catch (err: any) {
        setError(err.message || "An error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchAccount()

    // Track mouse movements for behavioral analysis
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
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError("")
    setIsScanning(true)
    setAnomalyDetected(null)
    setAnomalyType(null)
    setSuccess(false)

    try {
      // Calculate session duration in seconds
      const sessionDuration = Math.floor((Date.now() - transferStartTime) / 1000)

      // Prepare transfer data with behavioral metrics
      const transferData = {
        fromAccountId: account?.account_id,
        toAccountId: toAccount,
        amount: Number.parseFloat(amount),
        description,
        transferType: transferType === "individual" ? "Individual Payment" : "Merchant / Business Payment",
        userId,
        behavioralMetrics: {
          cursorMovements,
          sessionDuration,
          latitude: location.latitude,
          longitude: location.longitude,
        },
      }

      // Send transfer request to MySQL API
      const response = await fetch("/api/transactions/transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(transferData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Transfer failed")
      }

      // Store event ID and user ID for alerts
      setEventId(data.transactionId || null)
      setTransactionData(data)

      // Check if anomaly was detected
      if (data.anomalyDetected) {
        setAnomalyDetected(true)
        setAnomalyType(data.anomalyType || "Suspicious transaction activity")

        // Show TOTP verification for medium/high risk
        if (data.riskLevel === "medium" || data.riskLevel === "high") {
          setIsScanning(false)
          setShowTOTP(true)
        } else {
          setTimeout(() => {
            setSuccess(true)
            setIsScanning(false)
          }, 2000)
        }
      } else {
        setAnomalyDetected(false)
        setTimeout(() => {
          setSuccess(true)
          setIsScanning(false)
        }, 2000)
      }
      setTimeout(() => {
        router.push(`/transactions?phone=${"+918122213486"}&action=signup&userId=${data.userId}`)
      }, 2000)
    } catch (err: any) {
      setError(err.message || "An error occurred during transfer")
      setIsScanning(false)
    } finally {
      setSubmitting(false)
    }
  }

  const handleScanComplete = () => {
    setIsScanning(false)
  }

  const handleTOTPVerified = () => {
    setShowTOTP(false)
    setSuccess(true)
  }

  if (loading) {
    return (
      <Container fluid className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
        <Spinner animation="border" variant="primary" />
      </Container>
    )
  }

  return (
    <Container fluid className="min-vh-100 bg-light py-5">
      <Row className="justify-content-center">
        <Col xs={12} md={10} lg={8} xl={6}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h1 className="fw-bold text-primary mb-0">Transfer Money</h1>
              <Button variant="outline-secondary" onClick={() => router.push("/dashboard")}>
                Back to Dashboard
              </Button>
            </div>

            {isScanning || anomalyDetected !== null ? (
              <Card className="border-0 shadow-sm">
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
                      alertType="transaction_anomaly"
                      message={anomalyType || "Suspicious transaction attempt detected"}
                      isAnomaly={anomalyDetected}
                    />
                  )}
                </Card.Body>
              </Card>
            ) : showTOTP ? (
              <TOTPVerification
                userId={userId || ""}
                transactionId={transactionData?.transactionId}
                onVerified={handleTOTPVerified}
                onCancel={() => router.push("/dashboard")}
              />
            ) : success ? (
              <Card className="border-0 shadow-sm">
                <Card.Body className="p-4 text-center">
                  <h2 className="text-success mb-3">Money has been successfully transferred.</h2>
                  <Button variant="primary" onClick={() => router.push("/dashboard")}>
                    Go to Dashboard
                  </Button>
                </Card.Body>
              </Card>
            ) : (
              <Card className="border-0 shadow-sm">
                <Card.Body className="p-4">
                  <Card.Title className="mb-4">New Transfer</Card.Title>
                  <Card.Subtitle className="text-muted mb-4">
                    Transfer money to an individual or merchant/business account
                  </Card.Subtitle>

                  {error && (
                    <Alert variant="danger" className="mb-4">
                      <Alert.Heading>Error</Alert.Heading>
                      <p>{error}</p>
                    </Alert>
                  )}

                  <Form onSubmit={handleSubmit}>
                    <Form.Group className="mb-3">
                      <Form.Label>From Account</Form.Label>
                      <Form.Control
                        type="text"
                        value={
                          account ? ` ${account.account_name} (${account.account_id}) - ₹${account.balance?.toLocaleString() || "0"}`
                            : "Loading account information..."
                        }
                        readOnly
                        plaintext/>
                      
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>Transfer Type</Form.Label>
                      <div className="d-flex gap-3">
                        <Form.Check
                          type="radio"
                          id="individual-payment"
                          label="Individual Payment"
                          name="transferType"
                          checked={transferType === "individual"}
                          onChange={() => setTransferType("individual")}
                        />
                        <Form.Check
                          type="radio"
                          id="merchant-payment"
                          label="Merchant / Business Payment"
                          name="transferType"
                          checked={transferType === "merchant"}
                          onChange={() => setTransferType("merchant")}
                        />
                      </div>
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>To Account</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="Enter beneficiary account number"
                        value={toAccount}
                        onChange={(e) => setToAccount(e.target.value)}
                        required
                      />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>Amount (₹)</Form.Label>
                      <Form.Control
                        type="number"
                        placeholder="Enter amount"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        min="1"
                        step="0.01"
                        required
                      />
                    </Form.Group>

                    <Form.Group className="mb-4">
                      <Form.Label>Description (Optional)</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="Enter description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                    </Form.Group>

                    <div className="d-flex justify-content-between">
                      <Button variant="outline-secondary" onClick={() => router.push("/dashboard")}>
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                        disabled={submitting || !toAccount || !amount}
                      >
                        {submitting ? (
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
                          "Transfer Money"
                        )}
                      </Button>
                    </div>
                  </Form>
                </Card.Body>
              </Card>
            )}
          </motion.div>
        </Col>
      </Row>
    </Container>
  )
}