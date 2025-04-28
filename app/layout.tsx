import type React from "react"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import DBInitializer from "@/components/db-initializer"
import "./globals.css"
import "bootstrap/dist/css/bootstrap.min.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "Indian Overseas Bank - Secure Banking",
  description: "IOB Banking with Advanced Anomaly Detection",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <DBInitializer />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
