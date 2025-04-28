import Link from "next/link"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle } from "lucide-react"

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

interface TransactionListProps {
  transactions: Transaction[]
  title: string
  showViewAll?: boolean
}

export default function TransactionList({ transactions, title, showViewAll = false }: TransactionListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Your recent transaction history</CardDescription>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <p className="text-center py-6 text-gray-500">No transactions found</p>
        ) : (
          <div className="space-y-4">
            {transactions.map((transaction) => (
              <div
                key={transaction.transaction_id}
                className={`p-4 border rounded-lg flex justify-between items-center ${
                  transaction.is_anomalous ? "border-red-300 bg-red-50" : ""
                }`}
              >
                <div className="flex items-start space-x-3">
                  {transaction.is_anomalous && <AlertTriangle className="h-5 w-5 text-red-500 mt-1 flex-shrink-0" />}
                  <div>
                    <div className="flex items-center">
                      <h3 className="font-medium">
                        {transaction.transaction_amount > 0 ? "Received" : "Sent"} ₹
                        {Math.abs(transaction.transaction_amount).toLocaleString()}
                      </h3>
                      {transaction.is_anomalous && (
                        <Badge variant="destructive" className="ml-2">
                          Suspicious
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {transaction.transaction_amount > 0
                        ? `From: ${transaction.from_account_id.slice(-4).padStart(8, "*")}`
                        : `To: ${transaction.to_account_id.slice(-4).padStart(8, "*")}`}
                    </p>
                    {transaction.anomaly_type && (
                      <p className="text-xs text-red-500 mt-1">Reason: {transaction.anomaly_type}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">
                    {new Date(transaction.transaction_timestamp).toLocaleDateString()}
                  </p>
                  <Button variant="link" className="p-0 h-auto text-blue-800 text-sm">
                    Details
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      {showViewAll && (
        <CardFooter>
          <Button asChild variant="outline" className="w-full">
            <Link href="/transactions">View All Transactions</Link>
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
