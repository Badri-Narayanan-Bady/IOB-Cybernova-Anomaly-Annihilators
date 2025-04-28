"use client"

import { useEffect, useRef } from "react"
import { Chart, registerables } from "chart.js"

// Register Chart.js components
Chart.register(...registerables)

interface Transaction {
  transaction_id: string
  from_account_id: string
  to_account_id: string
  transaction_amount: number
  currency: string
  transaction_timestamp: string
}

interface SpendingChartProps {
  transactions: Transaction[]
}

export default function SpendingChart({ transactions }: SpendingChartProps) {
  const chartRef = useRef<HTMLCanvasElement>(null)
  const chartInstance = useRef<Chart | null>(null)

  useEffect(() => {
    if (!chartRef.current || !transactions.length) return

    // Destroy previous chart instance if it exists
    if (chartInstance.current) {
      chartInstance.current.destroy()
    }

    // Process transaction data
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const date = new Date()
      date.setMonth(date.getMonth() - i)
      return date.toLocaleString("default", { month: "short" })
    }).reverse()

    // Group transactions by month
    const monthlyData = last6Months.map((month) => {
      const monthTransactions = transactions.filter((t) => {
        const txDate = new Date(t.transaction_timestamp)
        return txDate.toLocaleString("default", { month: "short" }) === month
      })

      // Calculate income and expenses
      const income = monthTransactions
        .filter((t) => t.transaction_amount > 0)
        .reduce((sum, t) => sum + t.transaction_amount, 0)

      const expenses = monthTransactions
        .filter((t) => t.transaction_amount < 0)
        .reduce((sum, t) => sum + Math.abs(t.transaction_amount), 0)

      return { month, income, expenses }
    })

    // Create chart
    const ctx = chartRef.current.getContext("2d")
    if (ctx) {
      chartInstance.current = new Chart(ctx, {
        type: "bar",
        data: {
          labels: monthlyData.map((d) => d.month),
          datasets: [
            {
              label: "Income",
              data: monthlyData.map((d) => d.income),
              backgroundColor: "rgba(34, 197, 94, 0.7)",
              borderColor: "rgba(34, 197, 94, 1)",
              borderWidth: 1,
            },
            {
              label: "Expenses",
              data: monthlyData.map((d) => d.expenses),
              backgroundColor: "rgba(239, 68, 68, 0.7)",
              borderColor: "rgba(239, 68, 68, 1)",
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: (value) => "₹ " + value.toLocaleString(),
              },
            },
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: (context) => {
                  let label = context.dataset.label || ""
                  if (label) {
                    label += ": "
                  }
                  if (context.parsed.y !== null) {
                    label += "₹ " + context.parsed.y.toLocaleString()
                  }
                  return label
                },
              },
            },
          },
        },
      })
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy()
      }
    }
  }, [transactions])

  return <canvas ref={chartRef} />
}
