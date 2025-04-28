"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  BarChart,
  CreditCard,
  DollarSign,
  Home,
  LogOut,
  Settings,
  User,
  X,
  AlertTriangle,
  Download,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { useMobile } from "@/hooks/use-mobile"
import DashboardHeader from "@/components/dashboard-header"
import TransactionList from "@/components/transaction-list"
import AccountSummary from "@/components/account-summary"
import SpendingChart from "@/components/spending-chart"
import QRCodeDisplay from "@/components/qr-code-display"
import { supabase } from "@/lib/supabase"

interface Account {
  account_id: string
  account_type: string
  account_name: string
  balance: number
}

interface Transaction {
  transaction_id: string
  from_account_id: string
  to_account_id: string
  transaction_amount: number
  currency: string
  transaction_timestamp: string
  is_anomalous?: boolean
  anomaly_type?: string
}

export default function Dashboard() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [anomalyAlerts, setAnomalyAlerts] = useState<Transaction[]>([])
  const [showQRCode, setShowQRCode] = useState(false)
  const [userData, setUserData] = useState<any>(null)
  const { toast } = useToast()
  const isMobile = useMobile()

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Get current user
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          throw new Error("Not authenticated")
        }

        setUserData(user)

        // Fetch accounts data
        const { data: accountsData, error: accountsError } = await supabase
          .from("accounts")
          .select("*")
          .eq("user_id", user.id)

        if (accountsError) throw accountsError
        setAccounts(accountsData || [])

        // Fetch recent transactions
        const { data: transactionsData, error: transactionsError } = await supabase
          .from("transactions")
          .select(`
            transaction_id,
            from_account_id,
            to_account_id,
            transaction_amount,
            currency,
            transaction_timestamp,
            anomaly_labels(is_anomalous, anomaly_type)
          `)
          .or(
            `from_account_id.eq.${accountsData.map((a) => a.account_id).join(",")},to_account_id.eq.${accountsData.map((a) => a.account_id).join(",")}`,
          )
          .order("transaction_timestamp", { ascending: false })
          .limit(20)

        if (transactionsError) throw transactionsError

        // Process transactions to include anomaly data
        const processedTransactions = transactionsData.map((t) => ({
          ...t,
          is_anomalous: t.anomaly_labels?.is_anomalous || false,
          anomaly_type: t.anomaly_labels?.anomaly_type || null,
        }))

        setTransactions(processedTransactions)

        // Filter anomalous transactions
        const anomalies = processedTransactions.filter((t) => t.is_anomalous)
        setAnomalyAlerts(anomalies)

        // Show toast notification if anomalies exist
        if (anomalies.length > 0) {
          toast({
            title: "Security Alert",
            description: `${anomalies.length} suspicious transaction(s) detected. Please review.`,
            variant: "destructive",
          })
        }
      } catch (err: any) {
        setError(err.message || "An error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [toast])

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  const toggleQRCode = () => {
    setShowQRCode(!showQRCode)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-800"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar - Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={toggleSidebar}></div>
      )}

      {/* Sidebar */}
      <aside
        className={`${
          isMobile
            ? `fixed inset-y-0 left-0 z-50 w-64 transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} transition-transform duration-200 ease-in-out`
            : "w-64"
        } bg-blue-800 text-white flex flex-col`}
      >
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <img src="/placeholder.svg?height=40&width=40" alt="IOB Logo" className="h-8 w-8" />
            <h1 className="text-xl font-bold">IOB Banking</h1>
          </div>
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={toggleQRCode} aria-label="Close QR code">
            <X size={20} />
          </Button>          
          )}
        </div>

        <div className="p-4 border-t border-blue-700">
          <div className="flex items-center space-x-3">
            <Avatar>
              <AvatarFallback className="bg-blue-600">
                {userData?.user_metadata?.full_name?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{userData?.user_metadata?.full_name || "User"}</p>
              <p className="text-sm text-blue-200">Last login: Today, 10:45 AM</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            <li>
              <Link href="/dashboard" className="flex items-center space-x-3 p-2 rounded-md bg-blue-700 text-white">
                <Home size={20} />
                <span>Dashboard</span>
              </Link>
            </li>
            <li>
              <Link
                href="/accounts"
                className="flex items-center space-x-3 p-2 rounded-md hover:bg-blue-700 text-blue-100"
              >
                <CreditCard size={20} />
                <span>Accounts</span>
              </Link>
            </li>
            <li>
              <Link
                href="/transfer"
                className="flex items-center space-x-3 p-2 rounded-md hover:bg-blue-700 text-blue-100"
              >
                <DollarSign size={20} />
                <span>Transfer</span>
              </Link>
            </li>
            <li>
              <Link
                href="/transactions"
                className="flex items-center space-x-3 p-2 rounded-md hover:bg-blue-700 text-blue-100"
              >
                <BarChart size={20} />
                <span>Transactions</span>
              </Link>
            </li>
            <li>
              <Link
                href="/profile"
                className="flex items-center space-x-3 p-2 rounded-md hover:bg-blue-700 text-blue-100"
              >
                <User size={20} />
                <span>Profile</span>
              </Link>
            </li>
            <li>
              <Link
                href="/settings"
                className="flex items-center space-x-3 p-2 rounded-md hover:bg-blue-700 text-blue-100"
              >
                <Settings size={20} />
                <span>Settings</span>
              </Link>
            </li>
          </ul>
        </nav>

        <div className="p-4 border-t border-blue-700">
          <Button
            variant="outline"
            className="w-full justify-start text-white border-blue-600 hover:bg-blue-700 hover:text-white"
            onClick={async () => {
              await supabase.auth.signOut()
              window.location.href = "/login"
            }}
          >
            <LogOut size={20} className="mr-2" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        <DashboardHeader
          toggleSidebar={toggleSidebar}
          anomalyCount={anomalyAlerts.length}
          toggleQRCode={toggleQRCode}
        />

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {/* QR Code Modal */}
          {showQRCode && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg p-6 max-w-md w-full">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold">Scan with IOB Authenticator</h3>
                  <Button variant="ghost" size="icon" onClick={toggleQRCode}>
                    <X size={20} />
                  </Button>
                </div>
                <QRCodeDisplay
                  userId={userData?.id}
                  accountId={accounts[0]?.account_id}
                  userName={userData?.user_metadata?.full_name || "User"}
                />
                <p className="text-sm text-gray-500 mt-4 text-center">
                  Scan this QR code with the IOB Authenticator app to enable secure authentication
                </p>
              </div>
            </div>
          )}

          {anomalyAlerts.length > 0 && (
            <Alert variant="destructive" className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Security Alert</AlertTitle>
              <AlertDescription>
                We've detected {anomalyAlerts.length} suspicious transaction(s). Please review them in the transactions
                tab.
              </AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="overview">
            <TabsList className="mb-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="accounts">Accounts</TabsTrigger>
              <TabsTrigger value="transactions">Recent Transactions</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-500">Total Balance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      ₹ {accounts.reduce((sum, account) => sum + (account.balance || 0), 0).toLocaleString()}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Across {accounts.length} accounts</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-500">Recent Transactions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{transactions.length}</div>
                    <p className="text-xs text-gray-500 mt-1">In the last 30 days</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-500">Security Alerts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-500">{anomalyAlerts.length}</div>
                    <p className="text-xs text-gray-500 mt-1">Suspicious activities detected</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AccountSummary accounts={accounts} />
                <TransactionList
                  transactions={transactions.slice(0, 5)}
                  title="Recent Transactions"
                  showViewAll={true}
                />
              </div>
            </TabsContent>

            <TabsContent value="accounts">
              <Card>
                <CardHeader>
                  <CardTitle>Your Accounts</CardTitle>
                  <CardDescription>Manage and view all your bank accounts</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {accounts.map((account) => (
                      <div key={account.account_id} className="p-4 border rounded-lg flex justify-between items-center">
                        <div>
                          <h3 className="font-medium">{account.account_name}</h3>
                          <p className="text-sm text-gray-500">
                            {account.account_type} •{" "}
                            {account.account_id.slice(-4).padStart(account.account_id.length, "*")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">₹ {account.balance?.toLocaleString() || "0"}</p>
                          <Button variant="link" className="p-0 h-auto text-blue-800">
                            View Details
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="transactions">
              <TransactionList transactions={transactions} title="All Recent Transactions" showViewAll={false} />
            </TabsContent>

            <TabsContent value="analytics">
              <Card>
                <CardHeader>
                  <CardTitle>Spending Analytics</CardTitle>
                  <CardDescription>View your spending patterns over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <SpendingChart transactions={transactions} />
                  </div>
                </CardContent>
              </Card>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Monthly Statements</CardTitle>
                    <CardDescription>Download your account statements</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[
                        { month: "April 2023", url: "#" },
                        { month: "March 2023", url: "#" },
                        { month: "February 2023", url: "#" },
                      ].map((statement) => (
                        <div key={statement.month} className="flex justify-between items-center p-3 border rounded-md">
                          <span>{statement.month}</span>
                          <Button variant="outline" size="sm" className="flex items-center gap-2">
                            <Download size={16} />
                            <span>PDF</span>
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Category Breakdown</CardTitle>
                    <CardDescription>Your spending by category</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[
                        { category: "Groceries", amount: 12500, percentage: 35 },
                        { category: "Utilities", amount: 8000, percentage: 22 },
                        { category: "Entertainment", amount: 5500, percentage: 15 },
                        { category: "Others", amount: 10000, percentage: 28 },
                      ].map((category) => (
                        <div key={category.category} className="space-y-1">
                          <div className="flex justify-between">
                            <span>{category.category}</span>
                            <span>₹ {category.amount.toLocaleString()}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${category.percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}
