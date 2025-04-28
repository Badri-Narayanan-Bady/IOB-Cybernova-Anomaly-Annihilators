"use client"

import Image from "next/image"
import Link from "next/link"
import { motion } from "framer-motion"

interface IOBLogoProps {
  size?: "small" | "medium" | "large"
  withText?: boolean
  className?: string
}

export default function IOBLogo({ size = "medium", withText = true, className = "" }: IOBLogoProps) {
  const sizes = {
    small: 40,
    medium: 60,
    large: 80,
  }

  const logoSize = sizes[size]

  return (
    <Link href="/" className={`d-flex align-items-center text-decoration-none ${className}`}>
      <motion.div
        whileHover={{ scale: 1.05 }}
        transition={{ type: "spring", stiffness: 400, damping: 10 }}
        className="d-flex align-items-center"
      >
        <Image src="/iob-logo.png" alt="Indian Overseas Bank" width={logoSize} height={logoSize} className="iob-logo" />
        {withText && (
          <div className="ms-2">
            <h1
              className={`fw-bold text-primary mb-0 ${size === "small" ? "fs-5" : size === "medium" ? "fs-4" : "fs-3"}`}
            >
              Indian Overseas Bank
            </h1>
            {size !== "small" && <p className="text-muted mb-0 small">Secure Banking</p>}
          </div>
        )}
      </motion.div>
    </Link>
  )
}
