"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from "react-bootstrap"
import PhoneInput from "react-phone-input-2"
import "react-phone-input-2/lib/style.css"
import IOBLogo from "@/components/iob-logo"

export default function CheckBalancePage() {
  const router = useRouter()
  const [accountId, setAccountId] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [balance, setBalance] = useState<number | null>(null)
  const [accountName, setAccountName] = useState("")
  const [accountType, setAccountType] = useState("")

  const handleCheckBalance = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setBalance(null)

    try {
      // Send balance check request to API
      const response = await fetch("/api/accounts/balance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accountId,
          phoneNumber,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Failed to check balance")
      }

      // Display balance
      setBalance(data.balance)
      setAccountName(data.accountName)
      setAccountType(data.accountType)
    } catch (err: any) {
      setError(err.message || "An error occurred while checking balance")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container fluid className="min-vh-100 d-flex align-items-center justify-content-center bg-gradient-primary py-5">
      <Row className="justify-content-center w-100">
        <Col xs={12} md={8} lg={6} xl={5}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="text-center mb-4">
              <IOBLogo size="large" />
              <p className="text-white mt-2">Check Your Account Balance</p>
            </div>

            <Card className="border-0 shadow-lg">
              <Card.Body className="p-4">
                {balance !== null ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="text-center py-4"
                  >
                    <div
                      className="bg-primary text-white rounded-circle mx-auto mb-4 d-flex align-items-center justify-content-center"
                      style={{ width: "100px", height: "100px" }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="48"
                        height="48"
                        fill="currentColor"
                        className="bi bi-wallet2"
                        viewBox="0 0 16 16"
                      >
                        <path d="M12.136.326A1.5 1.5 0 0 1 14 1.78V3h.5A1.5 1.5 0 0 1 16 4.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 13.5v-9a1.5 1.5 0 0 1 1.5-1.5h11.662l.162-.326zM1.5 3a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-13Z" />
                        <path d="M15.5 9.5a.5.5 0 0 1-.5.5h-5a.5.5 0 0 1 0-1h5a.5.5 0 0 1 .5.5z" />
                      </svg>
                    </div>
                    <h3 className="text-primary fw-bold mb-3">{accountName}</h3>
                    <p className="text-muted mb-1">{accountType} Account</p>
                    <p className="text-muted mb-1">Account Number: {accountId}</p>
                    <div className="bg-light rounded-3 p-4 my-3">
                      <h6 className="text-muted mb-1">Available Balance</h6>
                      <h2 className="text-primary fw-bold mb-0">₹ {balance.toLocaleString("en-IN")}</h2>
                    </div>
                    <div className="d-flex justify-content-center mt-4 gap-3">
                      <Button variant="primary" onClick={() => setBalance(null)}>
                        Check Another Account
                      </Button>
                      <Button variant="outline-primary" as={Link} href="/login">
                        Login to Internet Banking
                      </Button>
                    </div>
                  </motion.div>
                ) : (
                  <>
                    <Card.Title className="text-center mb-4 fw-bold text-primary fs-4">Account Balance</Card.Title>

                    {error && (
                      <Alert variant="danger" className="mb-4">
                        <Alert.Heading>Error</Alert.Heading>
                        <p>{error}</p>
                      </Alert>
                    )}

                    <Form onSubmit={handleCheckBalance}>
                      <Form.Group className="mb-3">
                        <Form.Label className="fw-bold">Account Number</Form.Label>
                        <Form.Control
                          type="text"
                          placeholder="Enter your account number"
                          value={accountId}
                          onChange={(e) => setAccountId(e.target.value)}
                          required
                          className="py-2"
                        />
                      </Form.Group>

                      <Form.Group className="mb-4">
                        <Form.Label className="fw-bold">Phone Number (with country code)</Form.Label>
                        <PhoneInput
                          country={"in"}
                          value={phoneNumber}
                          onChange={(phone) => setPhoneNumber("+" + phone)}
                          inputProps={{
                            required: true,
                          }}
                          containerClass="w-100"
                          inputClass="form-control w-100 py-2"
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
                              Checking...
                            </>
                          ) : (
                            "Check Balance"
                          )}
                        </Button>
                      </div>
                    </Form>
                  </>
                )}
              </Card.Body>
              {balance === null && (
                <Card.Footer className="bg-white border-0 p-4 pt-0 text-center">
                  <p className="mb-0">
                    Want to access all features?{" "}
                    <Link href="/login" className="text-decoration-none fw-bold text-primary">
                      Login
                    </Link>{" "}
                    or{" "}
                    <Link href="/signup" className="text-decoration-none fw-bold text-primary">
                      Sign Up
                    </Link>
                  </p>
                </Card.Footer>
              )}
            </Card>
          </motion.div>
        </Col>
      </Row>
    </Container>
  )
}
