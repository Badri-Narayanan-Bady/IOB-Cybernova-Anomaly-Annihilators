"use client"

import { useEffect, useState } from "react"

export default function DBInitializer() {
  const [initialized, setInitialized] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initializeDB = async () => {
      try {
        const response = await fetch("/api/db-init")

        // Log status and response text for debugging
        const responseText = await response.text()

        if (!response.ok) {
          throw new Error(`Failed to initialize database: ${response.status} ${response.statusText} - ${responseText}`)
        }

        setInitialized(true)
        console.log("✅ Database initialized successfully")
      } catch (err: any) {
        const errorMessage = err?.message || "An error occurred during database initialization"
        setError(errorMessage)
        console.error("❌ Database initialization error:", errorMessage)
      }
    }

    initializeDB()
  }, [])

  return null
}
