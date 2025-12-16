"use client"

import type React from "react"

interface SpaceButtonProps {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    type?: "button" | "submit" | "reset"
    className?: string
    icon?: React.ReactNode
}

export default function SpaceButton({
    children,
    onClick,
    disabled,
    type = "button",
    className = "",
    icon
}: SpaceButtonProps) {
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={`space-btn ${className}`}
        >
            <div className="space-btn-overlay" />
            <span className="space-btn-content">
                {children}
                {icon && <span className="space-btn-icon">{icon}</span>}
            </span>
        </button>
    )
}
