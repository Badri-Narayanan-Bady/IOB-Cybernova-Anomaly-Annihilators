"use client"

import { Bell, Menu, QrCode } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface DashboardHeaderProps {
  toggleSidebar: () => void
  toggleQRCode: () => void
  anomalyCount?: number
}

export default function DashboardHeader({ toggleSidebar, toggleQRCode, anomalyCount = 0 }: DashboardHeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 py-4 px-6 flex items-center justify-between">
      <div className="flex items-center">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} className="md:hidden mr-2">
          <Menu size={24} />
        </Button>
        <h2 className="text-xl font-semibold hidden md:block">Dashboard</h2>
      </div>

      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="icon" onClick={toggleQRCode} title="Show QR Code for IOB Authenticator">
          <QrCode size={20} />
        </Button>

        <div className="relative">
          <Button variant="ghost" size="icon">
            <Bell size={20} />
            {anomalyCount > 0 && (
              <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500">
                {anomalyCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>
    </header>
  )
}
