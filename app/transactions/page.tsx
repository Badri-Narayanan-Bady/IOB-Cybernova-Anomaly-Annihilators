"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertTriangle, Download, Filter, Search } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { DateRangePicker } from "@/components/date-range-picker"
import mysql from "mysql2/promise"
import { format } from "date-fns"

interface Transaction {
  transaction_id: string
  from_account_id: string
  to_account_id: string
  transaction_amount: number
  currency: string
  transaction_timestamp: string
  is_anomalous?: boolean
  anomaly_type?: string
  from_account?: { account_name: string }
  to_account?: { account_name: string }
  description?: string
}

export default function TransactionsPage() {
  const router = useRouter()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  })
  const [transactionType, setTransactionType] = useState("all")
  const [amountRange, setAmountRange] = useState<{ min: string; max: string }>({ min: "", max: "" })
  const [showFilters, setShowFilters] = useState(false)
  const [accounts, setAccounts] = useState<any[]>([])
  const [selectedAccount, setSelectedAccount] = useState("all")

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const response = await fetch('/api/transactions');
        if (!response.ok) {
          throw new Error('Failed to fetch transactions');
        }
        const data = await response.json();

        // Process transactions to match expected format
        const processedTransactions = data.map((t: any) => ({
          ...t,
          from_account: { account_name: t.from_account_name },
          to_account: { account_name: t.to_account_name },
          is_anomalous: t.is_anomalous || false,
          anomaly_type: t.anomaly_type || null
        }));

        setTransactions(processedTransactions);
        setFilteredTransactions(processedTransactions);
      } catch (err: any) {
        setError(err.message || "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, []);

  // Apply filters when any filter changes
  useEffect(() => {
    let filtered = [...transactions];

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (t) =>
          t.transaction_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.from_account?.account_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.to_account?.account_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.description?.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    // Filter by date range
    if (dateRange.from) {
      filtered = filtered.filter((t) => new Date(t.transaction_timestamp) >= dateRange.from!);
    }
    if (dateRange.to) {
      const toDate = new Date(dateRange.to);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((t) => new Date(t.transaction_timestamp) <= toDate);
    }

    // Filter by transaction type
    if (transactionType !== "all") {
      if (transactionType === "credit") {
        filtered = filtered.filter((t) => t.transaction_amount > 0);
      } else if (transactionType === "debit") {
        filtered = filtered.filter((t) => t.transaction_amount < 0);
      } else if (transactionType === "anomalous") {
        filtered = filtered.filter((t) => t.is_anomalous);
      }
    }

    // Filter by amount range
    if (amountRange.min) {
      filtered = filtered.filter((t) => Math.abs(t.transaction_amount) >= Number.parseFloat(amountRange.min));
    }
    if (amountRange.max) {
      filtered = filtered.filter((t) => Math.abs(t.transaction_amount) <= Number.parseFloat(amountRange.max));
    }

    // Filter by account
    if (selectedAccount !== "all") {
      filtered = filtered.filter((t) => t.from_account_id === selectedAccount || t.to_account_id === selectedAccount);
    }

    setFilteredTransactions(filtered);
  }, [transactions, searchTerm, dateRange, transactionType, amountRange, selectedAccount]);

  // Rest of the component remains the same...
  const handleDownloadStatement = () => {
    // Generate CSV data
    const headers = ["Date", "Description", "From Account", "To Account", "Amount", "Status"];
    const csvData = [
      headers.join(","),
      ...filteredTransactions.map((t) =>
        [
          format(new Date(t.transaction_timestamp), "yyyy-MM-dd HH:mm:ss"),
          t.description || "Transfer",
          t.from_account?.account_name || t.from_account_id,
          t.to_account?.account_name || t.to_account_id,
          `${t.currency} ${t.transaction_amount.toFixed(2)}`,
          t.is_anomalous ? "Flagged" : "Normal",
        ].join(","),
      ),
    ].join("\n");

    // Create download link
    const blob = new Blob([csvData], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.setAttribute("hidden", "");
    a.setAttribute("href", url);
    a.setAttribute("download", `transactions_${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-800"></div>
      </div>
    );
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
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* ... rest of the JSX remains exactly the same ... */}
    </div>
  );
}