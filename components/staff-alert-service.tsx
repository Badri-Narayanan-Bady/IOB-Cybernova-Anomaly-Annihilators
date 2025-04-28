"use client"

import { useEffect } from "react"

interface StaffAlertServiceProps {
  eventId?: string
  userId?: string
  alertType: string
  message: string
  isAnomaly: boolean
}

export default function StaffAlertService({ eventId, userId, alertType, message, isAnomaly }: StaffAlertServiceProps) {
  useEffect(() => {
    // Only send alerts for anomalies
    if (!isAnomaly) return

    const sendStaffAlert = async () => {
      try {
        await fetch("/api/alerts/staff", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            eventId: eventId || `alert-${Date.now()}`,
            userId: userId || "unknown",
            alertType,
            message,
          }),
        })
        console.log("Staff alert sent successfully")
      } catch (error) {
        console.error("Error sending staff alert:", error)
      }
    }

    sendStaffAlert()
  }, [eventId, userId, alertType, message, isAnomaly])

  // This is a service component that doesn't render anything
  return null
}
