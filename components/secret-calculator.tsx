"use client"
import { useState, useEffect } from "react"

type CalculatorProps = {
  onSecretCodeEntered: () => void
}

export default function SecretCalculator({ onSecretCodeEntered }: CalculatorProps) {
  const [display, setDisplay] = useState("0")
  const [firstOperand, setFirstOperand] = useState<number | null>(null)
  const [operator, setOperator] = useState<string | null>(null)
  const [waitingForSecondOperand, setWaitingForSecondOperand] = useState(false)
  const [lastOperation, setLastOperation] = useState("")

  useEffect(() => {
    if (lastOperation === "33-7=") {
      onSecretCodeEntered()
    }
  }, [lastOperation, onSecretCodeEntered])

  const inputDigit = (digit: string) => {
    if (waitingForSecondOperand) {
      setDisplay(digit)
      setWaitingForSecondOperand(false)
    } else {
      setDisplay(display === "0" ? digit : display + digit)
    }
  }

  const inputDecimal = () => {
    if (waitingForSecondOperand) {
      setDisplay("0.")
      setWaitingForSecondOperand(false)
      return
    }
    if (!display.includes(".")) {
      setDisplay(display + ".")
    }
  }

  const clearDisplay = () => {
    setDisplay("0")
    setFirstOperand(null)
    setOperator(null)
    setWaitingForSecondOperand(false)
  }

  const toggleSign = () => {
    setDisplay(String(-Number.parseFloat(display)))
  }

  const inputPercent = () => {
    setDisplay(String(Number.parseFloat(display) / 100))
  }

  const handleOperator = (nextOperator: string) => {
    const inputValue = Number.parseFloat(display)
    if (firstOperand === null) {
      setFirstOperand(inputValue)
    } else if (operator) {
      const result = performCalculation(operator, firstOperand, inputValue)
      setDisplay(String(result))
      setFirstOperand(result)
    }
    setWaitingForSecondOperand(true)
    setOperator(nextOperator)
  }

  const performCalculation = (op: string, first: number, second: number): number => {
    switch (op) {
      case "+":
        return first + second
      case "-":
        return first - second
      case "×":
        return first * second
      case "÷":
        return first / second
      default:
        return second
    }
  }

  const handleEquals = () => {
    if (firstOperand === null || operator === null) return
    const inputValue = Number.parseFloat(display)
    const result = performCalculation(operator, firstOperand, inputValue)
    setLastOperation(`${firstOperand}${operator}${inputValue}=`)
    setDisplay(String(result))
    setFirstOperand(result)
    setOperator(null)
    setWaitingForSecondOperand(true)
  }

  const isOperatorActive = (op: string) => operator === op && waitingForSecondOperand

  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        backgroundColor: "#000000",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-end",
        padding: "20px",
        paddingBottom: "40px",
        overflow: "hidden",
        position: "fixed",
        top: 0,
        left: 0,
      }}
    >
      <div style={{ width: "100%", maxWidth: "400px", display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* Display */}
        <div
          style={{
            minHeight: "100px",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "flex-end",
            padding: "0 20px 10px 20px",
          }}
        >
          <span
            style={{
              color: "#ffffff",
              fontSize: display.length > 6 ? "clamp(2rem, 8vw, 3.5rem)" : "clamp(3rem, 10vw, 5rem)",
              fontWeight: "300",
              fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
              wordBreak: "break-all",
            }}
          >
            {display}
          </span>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "clamp(8px, 2vw, 12px)" }}>
          {/* Row 1 */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: "clamp(8px, 2vw, 12px)" }}>
            <button
              onClick={clearDisplay}
              style={{
                flex: 1,
                aspectRatio: "1",
                maxWidth: "calc(25% - 9px)",
                borderRadius: "50%",
                border: "none",
                backgroundColor: "#a5a5a5",
                color: "#000000",
                fontSize: "clamp(1.2rem, 4vw, 1.5rem)",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              {firstOperand === null ? "AC" : "C"}
            </button>
            <button
              onClick={toggleSign}
              style={{
                flex: 1,
                aspectRatio: "1",
                maxWidth: "calc(25% - 9px)",
                borderRadius: "50%",
                border: "none",
                backgroundColor: "#a5a5a5",
                color: "#000000",
                fontSize: "clamp(1.2rem, 4vw, 1.5rem)",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              +/-
            </button>
            <button
              onClick={inputPercent}
              style={{
                flex: 1,
                aspectRatio: "1",
                maxWidth: "calc(25% - 9px)",
                borderRadius: "50%",
                border: "none",
                backgroundColor: "#a5a5a5",
                color: "#000000",
                fontSize: "clamp(1.2rem, 4vw, 1.5rem)",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              %
            </button>
            <button
              onClick={() => handleOperator("÷")}
              style={{
                flex: 1,
                aspectRatio: "1",
                maxWidth: "calc(25% - 9px)",
                borderRadius: "50%",
                border: "none",
                backgroundColor: isOperatorActive("÷") ? "#ffffff" : "#ff9f0a",
                color: isOperatorActive("÷") ? "#ff9f0a" : "#ffffff",
                fontSize: "clamp(1.3rem, 4.5vw, 1.75rem)",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              ÷
            </button>
          </div>

          {/* Row 2 */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: "clamp(8px, 2vw, 12px)" }}>
            {["7", "8", "9"].map((num) => (
              <button
                key={num}
                onClick={() => inputDigit(num)}
                style={{
                  flex: 1,
                  aspectRatio: "1",
                  maxWidth: "calc(25% - 9px)",
                  borderRadius: "50%",
                  border: "none",
                  backgroundColor: "#333333",
                  color: "#ffffff",
                  fontSize: "clamp(1.3rem, 4.5vw, 1.75rem)",
                  fontWeight: "500",
                  cursor: "pointer",
                }}
              >
                {num}
              </button>
            ))}
            <button
              onClick={() => handleOperator("×")}
              style={{
                flex: 1,
                aspectRatio: "1",
                maxWidth: "calc(25% - 9px)",
                borderRadius: "50%",
                border: "none",
                backgroundColor: isOperatorActive("×") ? "#ffffff" : "#ff9f0a",
                color: isOperatorActive("×") ? "#ff9f0a" : "#ffffff",
                fontSize: "clamp(1.3rem, 4.5vw, 1.75rem)",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              ×
            </button>
          </div>

          {/* Row 3 */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: "clamp(8px, 2vw, 12px)" }}>
            {["4", "5", "6"].map((num) => (
              <button
                key={num}
                onClick={() => inputDigit(num)}
                style={{
                  flex: 1,
                  aspectRatio: "1",
                  maxWidth: "calc(25% - 9px)",
                  borderRadius: "50%",
                  border: "none",
                  backgroundColor: "#333333",
                  color: "#ffffff",
                  fontSize: "clamp(1.3rem, 4.5vw, 1.75rem)",
                  fontWeight: "500",
                  cursor: "pointer",
                }}
              >
                {num}
              </button>
            ))}
            <button
              onClick={() => handleOperator("-")}
              style={{
                flex: 1,
                aspectRatio: "1",
                maxWidth: "calc(25% - 9px)",
                borderRadius: "50%",
                border: "none",
                backgroundColor: isOperatorActive("-") ? "#ffffff" : "#ff9f0a",
                color: isOperatorActive("-") ? "#ff9f0a" : "#ffffff",
                fontSize: "clamp(1.3rem, 4.5vw, 1.75rem)",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              -
            </button>
          </div>

          {/* Row 4 */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: "clamp(8px, 2vw, 12px)" }}>
            {["1", "2", "3"].map((num) => (
              <button
                key={num}
                onClick={() => inputDigit(num)}
                style={{
                  flex: 1,
                  aspectRatio: "1",
                  maxWidth: "calc(25% - 9px)",
                  borderRadius: "50%",
                  border: "none",
                  backgroundColor: "#333333",
                  color: "#ffffff",
                  fontSize: "clamp(1.3rem, 4.5vw, 1.75rem)",
                  fontWeight: "500",
                  cursor: "pointer",
                }}
              >
                {num}
              </button>
            ))}
            <button
              onClick={() => handleOperator("+")}
              style={{
                flex: 1,
                aspectRatio: "1",
                maxWidth: "calc(25% - 9px)",
                borderRadius: "50%",
                border: "none",
                backgroundColor: isOperatorActive("+") ? "#ffffff" : "#ff9f0a",
                color: isOperatorActive("+") ? "#ff9f0a" : "#ffffff",
                fontSize: "clamp(1.3rem, 4.5vw, 1.75rem)",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              +
            </button>
          </div>

          {/* Row 5 */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: "clamp(8px, 2vw, 12px)" }}>
            <button
              onClick={() => inputDigit("0")}
              style={{
                flex: 2,
                height: "calc((100vw - 80px) / 4)",
                maxHeight: "80px",
                borderRadius: "40px",
                border: "none",
                backgroundColor: "#333333",
                color: "#ffffff",
                fontSize: "clamp(1.3rem, 4.5vw, 1.75rem)",
                fontWeight: "500",
                cursor: "pointer",
                paddingLeft: "clamp(20px, 6vw, 28px)",
                textAlign: "left",
              }}
            >
              0
            </button>
            <button
              onClick={inputDecimal}
              style={{
                flex: 1,
                aspectRatio: "1",
                maxWidth: "calc(25% - 9px)",
                borderRadius: "50%",
                border: "none",
                backgroundColor: "#333333",
                color: "#ffffff",
                fontSize: "clamp(1.3rem, 4.5vw, 1.75rem)",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              .
            </button>
            <button
              onClick={handleEquals}
              style={{
                flex: 1,
                aspectRatio: "1",
                maxWidth: "calc(25% - 9px)",
                borderRadius: "50%",
                border: "none",
                backgroundColor: "#ff9f0a",
                color: "#ffffff",
                fontSize: "clamp(1.3rem, 4.5vw, 1.75rem)",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              =
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
