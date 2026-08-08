"use client"

import { MeshGradient } from "@paper-design/shaders-react"
import { motion } from "framer-motion"
import { useState, useEffect, useRef } from "react"

export function MeshGradientSVG() {
  const colors = [
    "#FFB3D9", // Pastel pink
    "#87CEEB", // Sky blue
    "#4A90E2", // Medium blue
    "#2C3E50", // Dark blue-gray
    "#1A1A2E", // Very dark blue
  ]

  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 })
  const svgRef = useRef<SVGSVGElement | null>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY })
    }

    window.addEventListener("mousemove", handleMouseMove)
    return () => window.removeEventListener("mousemove", handleMouseMove)
  }, [])

  useEffect(() => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (rect) {
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2

      const deltaX = (mousePosition.x - centerX) * 0.08
      const deltaY = (mousePosition.y - centerY) * 0.08

      const maxOffset = 8
      setEyeOffset({
        x: Math.max(-maxOffset, Math.min(maxOffset, deltaX)),
        y: Math.max(-maxOffset, Math.min(maxOffset, deltaY)),
      })
    }
  }, [mousePosition])

  return (
    <motion.div
      className="mesh-gradient-container"
      animate={{
        y: [0, -8, 0],
      }}
      transition={{
        duration: 4,
        repeat: Number.POSITIVE_INFINITY,
        ease: "easeInOut",
      }}
      style={{ transformOrigin: "top center" }}
    >
      <svg 
        ref={svgRef}
        xmlns="http://www.w3.org/2000/svg" 
        width="231" 
        height="289" 
        viewBox="0 0 231 289" 
        className="mesh-gradient-svg"
      >
        <defs>
          <clipPath id="shapeClip">
            <path d="M230.809 115.385V249.411C230.809 269.923 214.985 287.282 194.495 288.411C184.544 288.949 175.364 285.718 168.26 280C159.746 273.154 147.769 273.461 139.178 280.23C132.638 285.384 124.381 288.462 115.379 288.462C106.377 288.462 98.1451 285.384 91.6055 280.23C82.912 273.385 70.9353 273.385 62.2415 280.23C55.7532 285.334 47.598 288.411 38.7246 288.462C17.4132 288.615 0 270.667 0 249.359V115.385C0 51.6667 51.6756 0 115.404 0C179.134 0 230.809 51.6667 230.809 115.385Z" />
          </clipPath>
        </defs>

        <foreignObject width="231" height="289" clipPath="url(#shapeClip)">
          <div className="mesh-gradient-wrapper">
            <MeshGradient colors={colors} className="mesh-gradient-canvas" speed={1} />
          </div>
        </foreignObject>

        <motion.ellipse
          rx="20"
          ry="30"
          fill="#111827"
          className="animate-blink"
          animate={{
            cx: 80 + eyeOffset.x,
            cy: 120 + eyeOffset.y,
          }}
          transition={{ type: "spring", stiffness: 150, damping: 15 }}
        />
        <motion.ellipse
          rx="20"
          ry="30"
          fill="#111827"
          className="animate-blink"
          animate={{
            cx: 150 + eyeOffset.x,
            cy: 120 + eyeOffset.y,
          }}
          transition={{ type: "spring", stiffness: 150, damping: 15 }}
        />
      </svg>
    </motion.div>
  )
}
