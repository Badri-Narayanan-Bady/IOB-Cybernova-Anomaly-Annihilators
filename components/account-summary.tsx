import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface Account {
  account_id: string
  account_type: string
  account_name: string
  balance: number
}

interface AccountSummaryProps {
  accounts: Account[]
}

export default function AccountSummary({ accounts }: AccountSummaryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Summary</CardTitle>
        <CardDescription>Overview of your bank accounts</CardDescription>
      </CardHeader>
      <CardContent>
        {accounts.length === 0 ? (
          <p className="text-center py-6 text-gray-500">No accounts found</p>
        ) : (
          <div className="space-y-4">
            {accounts.map((account) => (
              <div key={account.account_id} className="p-4 border rounded-lg flex justify-between items-center">
                <div>
                  <h3 className="font-medium">{account.account_name}</h3>
                  <p className="text-sm text-gray-500">
                    {account.account_type} • {account.account_id.slice(-4).padStart(account.account_id.length, "*")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold">₹ {account.balance?.toLocaleString() || "0"}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button asChild variant="outline" className="w-full">
          <Link href="/accounts">Manage Accounts</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
