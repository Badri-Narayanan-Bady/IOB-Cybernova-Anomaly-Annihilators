"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode.react"

interface QRCodeDisplayProps {
  userId: string
  accountId: string
  userName: string
}

export default function QRCodeDisplay({ userId, accountId, userName }: QRCodeDisplayProps) {
  const [qrData, setQrData] = useState("")

  useEffect(() => {
    // Generate QR code data
    if (userId && accountId) {
      const data = JSON.stringify({
        userId,
        accountId,
        userName,
        timestamp: new Date().toISOString(),
        type: "auth",
      })

      // Base64 encode the data
      const encodedData = btoa(data)
      setQrData(`iob-auth://${encodedData}`)
    }
  }, [userId, accountId, userName])

  if (!qrData) {
    return <div className="flex justify-center items-center h-64">Loading QR code...</div>
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="bg-white p-4 rounded-lg shadow-md">
        <QRCode value={qrData} size={200} level="H" includeMargin={true} renderAs="svg" />
      </div>
      <p className="mt-4 text-sm text-center">
        Scan with the IOB Authenticator app to enable secure login and transactions
      </p>
    </div>
  )
}
