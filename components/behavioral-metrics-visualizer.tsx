"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

interface BehavioralMetricsVisualizerProps {
  typingSpeed: number
  cursorMovements: number
  sessionDuration: number
  keystrokeTimings: number[]
}

export default function BehavioralMetricsVisualizer({
  typingSpeed,
  cursorMovements,
  sessionDuration,
  keystrokeTimings,
}: BehavioralMetricsVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [keystrokeVariance, setKeystrokeVariance] = useState<number>(0)

  // Calculate keystroke variance
  useEffect(() => {
    if (keystrokeTimings && keystrokeTimings.length > 1) {
      const mean = keystrokeTimings.reduce((a, b) => a + b, 0) / keystrokeTimings.length
      const variance = keystrokeTimings.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / keystrokeTimings.length
      setKeystrokeVariance(variance)
    }
  }, [keystrokeTimings])

  // Draw keystroke timing visualization
  useEffect(() => {
    if (!canvasRef.current || !keystrokeTimings || keystrokeTimings.length < 2) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas dimensions
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Calculate max and min timings for scaling
    const maxTiming = Math.max(...keystrokeTimings)
    const minTiming = Math.min(...keystrokeTimings)
    const range = maxTiming - minTiming || 1 // Avoid division by zero

    // Draw background
    ctx.fillStyle = "#f8f9fa"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw grid lines
    ctx.strokeStyle = "#e9ecef"
    ctx.lineWidth = 1
    for (let i = 0; i < 5; i++) {
      const y = (canvas.height / 5) * i
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(canvas.width, y)
      ctx.stroke()
    }

    // Draw keystroke timings
    const barWidth = Math.max(2, (canvas.width - 20) / keystrokeTimings.length - 2)
    const maxHeight = canvas.height - 20

    ctx.fillStyle = "#0066cc"
    keystrokeTimings.forEach((timing, index) => {
      const normalizedHeight = ((timing - minTiming) / range) * maxHeight
      const height = Math.max(2, normalizedHeight) // Ensure at least 2px height
      const x = 10 + index * (barWidth + 2)
      const y = canvas.height - 10 - height

      ctx.fillRect(x, y, barWidth, height)
    })

    // Draw average line
    const avgTiming = keystrokeTimings.reduce((a, b) => a + b, 0) / keystrokeTimings.length
    const avgY = canvas.height - 10 - ((avgTiming - minTiming) / range) * maxHeight

    ctx.strokeStyle = "#dc3545"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, avgY)
    ctx.lineTo(canvas.width, avgY)
    ctx.stroke()

    // Add label for average
    ctx.fillStyle = "#dc3545"
    ctx.font = "12px Arial"
    ctx.fillText(`Avg: ${avgTiming.toFixed(2)}ms`, 5, avgY - 5)
  }, [keystrokeTimings])

  // Normalize metrics for progress bars
  const normalizedTypingSpeed = Math.min(100, (typingSpeed / 10) * 100) // Assuming 10 chars/sec is max
  const normalizedCursorMovements = Math.min(100, (cursorMovements / 100) * 100) // Assuming 100 movements is max
  const normalizedSessionDuration = Math.min(100, (sessionDuration / 300) * 100) // Assuming 5 minutes is max
  const normalizedKeystrokeVariance = Math.min(100, (keystrokeVariance / 0.5) * 100) // Assuming 0.5s variance is max

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Behavioral Metrics Analysis</CardTitle>
        <CardDescription>Real-time analysis of user behavior for anomaly detection</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm font-medium">Typing Speed</span>
            <span className="text-sm text-muted-foreground">{typingSpeed.toFixed(2)} chars/sec</span>
          </div>
          <Progress value={normalizedTypingSpeed} className="h-2" />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm font-medium">Cursor Movements</span>
            <span className="text-sm text-muted-foreground">{cursorMovements} movements</span>
          </div>
          <Progress value={normalizedCursorMovements} className="h-2" />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm font-medium">Session Duration</span>
            <span className="text-sm text-muted-foreground">{sessionDuration} seconds</span>
          </div>
          <Progress value={normalizedSessionDuration} className="h-2" />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm font-medium">Keystroke Variance</span>
            <span className="text-sm text-muted-foreground">{keystrokeVariance.toFixed(4)} seconds</span>
          </div>
          <Progress value={normalizedKeystrokeVariance} className="h-2" />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm font-medium">Keystroke Timing Pattern</span>
            <span className="text-sm text-muted-foreground">{keystrokeTimings.length} keystrokes</span>
          </div>
          <div className="border rounded-md p-2">
            <canvas ref={canvasRef} className="w-full h-32" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
