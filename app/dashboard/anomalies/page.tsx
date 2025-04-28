"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"
import DashboardHeader from "@/components/dashboard-header"
import { useMobile } from "@/hooks/use-mobile"

interface AnomalyEvent {
  event_id: string
  event_type: string
  timestamp: string
  is_anomalous: boolean
  anomaly_type: string
  score: number
  details: any
}

export default function AnomaliesPage() {
  const [anomalies, setAnomalies] = useState<AnomalyEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isMobile = useMobile()

  useEffect(() => {
    const fetchAnomalies = async () => {
      try {
        const response = await fetch("/api/anomalies")
        if (!response.ok) {
          throw new Error("Failed to fetch anomalies")
        }
        const data = await response.json()
        setAnomalies(data)
      } catch (err: any) {
        setError(err.message || "An error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchAnomalies()
  }, [])

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  const loginAnomalies = anomalies.filter((a) => a.event_type === "login")
  const transactionAnomalies = anomalies.filter((a) => a.event_type === "transaction")

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-800"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <DashboardHeader toggleSidebar={toggleSidebar} />

      <main className="flex-1 p-4 md:p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Security Anomalies</h1>

          {error ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : anomalies.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <div className="bg-green-100 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-8 w-8 text-green-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">No Anomalies Detected</h3>
                  <p className="text-gray-500 max-w-md mx-auto">
                    Your account activity appears normal. We'll continue to monitor for any suspicious activities.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Tabs defaultValue="all">
              <TabsList className="mb-6">
                <TabsTrigger value="all">All Anomalies ({anomalies.length})</TabsTrigger>
                <TabsTrigger value="login">Login ({loginAnomalies.length})</TabsTrigger>
                <TabsTrigger value="transaction">Transaction ({transactionAnomalies.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="space-y-6">
                <AnomalyList anomalies={anomalies} />
              </TabsContent>

              <TabsContent value="login" className="space-y-6">
                <AnomalyList anomalies={loginAnomalies} />
              </TabsContent>

              <TabsContent value="transaction" className="space-y-6">
                <AnomalyList anomalies={transactionAnomalies} />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </main>
    </div>
  )
}

function AnomalyList({ anomalies }: { anomalies: AnomalyEvent[] }) {
  return (
    <div className="space-y-4">
      {anomalies.map((anomaly) => (
        <Card key={anomaly.event_id} className="border-red-200">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg">
                  {anomaly.event_type === "login" ? "Suspicious Login" : "Suspicious Transaction"}
                </CardTitle>
                <CardDescription>{new Date(anomaly.timestamp).toLocaleString()}</CardDescription>
              </div>
              <div className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded">
                Score: {(anomaly.score * 100).toFixed(0)}%
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-medium text-gray-500">Anomaly Type</h4>
                <p className="font-medium">{anomaly.anomaly_type}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {anomaly.event_type === "login" ? (
                  <>
                    <div>
                      <h4 className="text-sm font-medium text-gray-500">Login Location</h4>
                      <p>
                        {anomaly.details.latitude
                          ? `${anomaly.details.latitude.toFixed(4)}, ${anomaly.details.longitude.toFixed(4)}`
                          : "Unknown"}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-500">Login Time</h4>
                      <p>{anomaly.details.login_time_of_day || "Unknown"}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-500">Session Duration</h4>
                      <p>
                        {anomaly.details.session_duration ? `${anomaly.details.session_duration} seconds` : "Unknown"}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-500">Typing Speed</h4>
                      <p>
                        {anomaly.details.typing_speed
                          ? `${anomaly.details.typing_speed.toFixed(2)} chars/sec`
                          : "Unknown"}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <h4 className="text-sm font-medium text-gray-500">Transaction Amount</h4>
                      <p>₹{anomaly.details.transaction_amount?.toLocaleString() || "Unknown"}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-500">Transaction Location</h4>
                      <p>
                        {anomaly.details.latitude
                          ? `${anomaly.details.latitude.toFixed(4)}, ${anomaly.details.longitude.toFixed(4)}`
                          : "Unknown"}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-500">From Account</h4>
                      <p>{anomaly.details.from_account_id || "Unknown"}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-500">To Account</h4>
                      <p>{anomaly.details.to_account_id || "Unknown"}</p>
                    </div>
                  </>
                )}
              </div>

              <Alert variant="destructive" className="bg-red-50 text-red-800 border-red-200">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Security Recommendation</AlertTitle>
                <AlertDescription>
                  {anomaly.event_type === "login"
                    ? "If you don't recognize this login attempt, please change your password immediately and contact customer support."
                    : "If you didn't authorize this transaction, please contact customer support immediately to dispute the transaction."}
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
