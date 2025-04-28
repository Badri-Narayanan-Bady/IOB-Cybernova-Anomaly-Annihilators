"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Spinner, ProgressBar, Alert } from "react-bootstrap"

interface AnomalyDetectionScannerProps {
  isScanning: boolean
  anomalyDetected: boolean | null
  anomalyType?: string | null
  onComplete: () => void
}

export default function AnomalyDetectionScanner({
  isScanning,
  anomalyDetected,
  anomalyType,
  onComplete,
}: AnomalyDetectionScannerProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!isScanning) {
      return
    }

    // Simulate the scanning process
    const steps = [
      { step: 1, duration: 1500 }, // Scanning for anomalies
      { step: 2, duration: 1200 }, // Verifying location
      { step: 3, duration: 1800 }, // Checking for abnormal patterns
      { step: 4, duration: 1000 }, // Finalizing security check
    ]

    let totalDuration = 0
    const timers: NodeJS.Timeout[] = []

    steps.forEach((stepInfo) => {
      const timer = setTimeout(() => {
        setCurrentStep(stepInfo.step)
      }, totalDuration)

      totalDuration += stepInfo.duration
      timers.push(timer)
    })

    // Complete the process
    const finalTimer = setTimeout(() => {
      onComplete()
    }, totalDuration + 500)

    timers.push(finalTimer)

    // Progress bar animation
    const interval = setInterval(() => {
      setProgress((prev) => {
        const newProgress = prev + 1
        return newProgress > 100 ? 100 : newProgress
      })
    }, totalDuration / 100)

    return () => {
      timers.forEach(clearTimeout)
      clearInterval(interval)
    }
  }, [isScanning, onComplete])

  if (!isScanning && anomalyDetected === null) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="security-scanner-container p-4 rounded-lg shadow-lg bg-white"
    >
      {isScanning ? (
        <>
          <div className="text-center mb-4">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Number.POSITIVE_INFINITY, duration: 2 }}
              className="d-inline-block"
            >
              <div className="scanner-icon bg-primary text-white rounded-circle p-3 d-inline-flex mb-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  fill="currentColor"
                  className="bi bi-shield-lock"
                  viewBox="0 0 16 16"
                >
                  <path d="M5.338 1.59a61.44 61.44 0 0 0-2.837.856.481.481 0 0 0-.328.39c-.554 4.157.726 7.19 2.253 9.188a10.725 10.725 0 0 0 2.287 2.233c.346.244.652.42.893.533.12.057.218.095.293.118a.55.55 0 0 0 .101.025.615.615 0 0 0 .1-.025c.076-.023.174-.061.294-.118.24-.113.547-.29.893-.533a10.726 10.726 0 0 0 2.287-2.233c1.527-1.997 2.807-5.031 2.253-9.188a.48.48 0 0 0-.328-.39c-.651-.213-1.75-.56-2.837-.855C9.552 1.29 8.531 1.067 8 1.067c-.53 0-1.552.223-2.662.524zM5.072.56C6.157.265 7.31 0 8 0s1.843.265 2.928.56c1.11.3 2.229.655 2.887.87a1.54 1.54 0 0 1 1.044 1.262c.596 4.477-.787 7.795-2.465 9.99a11.775 11.775 0 0 1-2.517 2.453 7.159 7.159 0 0 1-1.048.625c-.28.132-.581.24-.829.24s-.548-.108-.829-.24a7.158 7.158 0 0 1-1.048-.625 11.777 11.777 0 0 1-2.517-2.453C1.928 10.487.545 7.169 1.141 2.692A1.54 1.54 0 0 1 2.185 1.43 62.456 62.456 0 0 1 5.072.56z" />
                  <path d="M9.5 6.5a1.5 1.5 0 0 1-1 1.415l.385 1.99a.5.5 0 0 1-.491.595h-.788a.5.5 0 0 1-.49-.595l.384-1.99a1.5 1.5 0 1 1 2-1.415z" />
                </svg>
              </div>
            </motion.div>
            <h4 className="fw-bold text-primary">Security Verification</h4>
            <p className="text-muted">Please wait while we verify your identity</p>
          </div>

          <div className="step-indicators mb-4">
            <div className="d-flex justify-content-between mb-2">
              <span className={`step-label ${currentStep >= 1 ? "text-primary fw-bold" : "text-muted"}`}>
                Scanning for anomalies
                {currentStep === 1 && <Spinner animation="border" size="sm" className="ms-2" />}
                {currentStep > 1 && <span className="text-success ms-2">✓</span>}
              </span>
              <span className="text-muted">
                {currentStep === 1 ? "In progress" : currentStep > 1 ? "Completed" : "Pending"}
              </span>
            </div>

            <div className="d-flex justify-content-between mb-2">
              <span className={`step-label ${currentStep >= 2 ? "text-primary fw-bold" : "text-muted"}`}>
                Verifying location
                {currentStep === 2 && <Spinner animation="border" size="sm" className="ms-2" />}
                {currentStep > 2 && <span className="text-success ms-2">✓</span>}
              </span>
              <span className="text-muted">
                {currentStep === 2 ? "In progress" : currentStep > 2 ? "Completed" : "Pending"}
              </span>
            </div>

            <div className="d-flex justify-content-between mb-2">
              <span className={`step-label ${currentStep >= 3 ? "text-primary fw-bold" : "text-muted"}`}>
                Checking for abnormal patterns
                {currentStep === 3 && <Spinner animation="border" size="sm" className="ms-2" />}
                {currentStep > 3 && <span className="text-success ms-2">✓</span>}
              </span>
              <span className="text-muted">
                {currentStep === 3 ? "In progress" : currentStep > 3 ? "Completed" : "Pending"}
              </span>
            </div>

            <div className="d-flex justify-content-between mb-2">
              <span className={`step-label ${currentStep >= 4 ? "text-primary fw-bold" : "text-muted"}`}>
                Finalizing security check
                {currentStep === 4 && <Spinner animation="border" size="sm" className="ms-2" />}
                {currentStep > 4 && <span className="text-success ms-2">✓</span>}
              </span>
              <span className="text-muted">
                {currentStep === 4 ? "In progress" : currentStep > 4 ? "Completed" : "Pending"}
              </span>
            </div>
          </div>

          <ProgressBar now={progress} variant="primary" className="mb-3" animated />

          <p className="text-center text-muted small">
            This security check helps protect your account from unauthorized access
          </p>
        </>
      ) : (
        <div className="text-center">
          {anomalyDetected ? (
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
            >
              <div className="alert-icon bg-danger text-white rounded-circle p-3 d-inline-flex mb-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  fill="currentColor"
                  className="bi bi-exclamation-triangle"
                  viewBox="0 0 16 16"
                >
                  <path d="M7.938 2.016A.13.13 0 0 1 8.002 2a.13.13 0 0 1 .063.016.146.146 0 0 1 .054.057l6.857 11.667c.036.06.035.124.002.183a.163.163 0 0 1-.054.06.116.116 0 0 1-.066.017H1.146a.115.115 0 0 1-.066-.017.163.163 0 0 1-.054-.06.176.176 0 0 1 .002-.183L7.884 2.073a.147.147 0 0 1 .054-.057zm1.044-.45a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566z" />
                  <path d="M7.002 12a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 5.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995z" />
                </svg>
              </div>
              <Alert variant="danger">
                <Alert.Heading>Security Alert</Alert.Heading>
                <p>We've detected unusual activity with your account.</p>
                <hr />
                <p className="mb-0">
                  {anomalyType || "Suspicious activity detected. Additional verification required."}
                </p>
              </Alert>
            </motion.div>
          ) : (
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
            >
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
              <Alert variant="success">
                <Alert.Heading>Verification Successful</Alert.Heading>
                <p>No security concerns detected. You're good to go!</p>
              </Alert>
            </motion.div>
          )}
        </div>
      )}
    </motion.div>
  )
}
