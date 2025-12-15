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
        minHeight: "100vh",
        width: "100%",
        backgroundColor: "#000000",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: "340px", padding: "0 10px" }}>
        {/* Display */}
        <div
          style={{
            height: "120px",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "flex-end",
            padding: "0 20px 20px 20px",
          }}
        >
          <span
            style={{
              color: "#ffffff",
              fontSize: display.length > 6 ? "3rem" : "4rem",
              fontWeight: "300",
              fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
            }}
          >
            {display}
          </span>
        </div>

        {/* Buttons - Using flexbox rows instead of grid */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Row 1: AC, +/-, %, ÷ */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
            <button
              onClick={clearDisplay}
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                border: "none",
                backgroundColor: "#a5a5a5",
                color: "#000000",
                fontSize: "1.5rem",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              {firstOperand === null ? "AC" : "C"}
            </button>
            <button
              onClick={toggleSign}
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                border: "none",
                backgroundColor: "#a5a5a5",
                color: "#000000",
                fontSize: "1.5rem",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              +/-
            </button>
            <button
              onClick={inputPercent}
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                border: "none",
                backgroundColor: "#a5a5a5",
                color: "#000000",
                fontSize: "1.5rem",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              %
            </button>
            <button
              onClick={() => handleOperator("÷")}
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                border: "none",
                backgroundColor: isOperatorActive("÷") ? "#ffffff" : "#ff9f0a",
                color: isOperatorActive("÷") ? "#ff9f0a" : "#ffffff",
                fontSize: "1.75rem",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              ÷
            </button>
          </div>

          {/* Row 2: 7, 8, 9, × */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
            <button
              onClick={() => inputDigit("7")}
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                border: "none",
                backgroundColor: "#333333",
                color: "#ffffff",
                fontSize: "1.75rem",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              7
            </button>
            <button
              onClick={() => inputDigit("8")}
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                border: "none",
                backgroundColor: "#333333",
                color: "#ffffff",
                fontSize: "1.75rem",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              8
            </button>
            <button
              onClick={() => inputDigit("9")}
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                border: "none",
                backgroundColor: "#333333",
                color: "#ffffff",
                fontSize: "1.75rem",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              9
            </button>
            <button
              onClick={() => handleOperator("×")}
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                border: "none",
                backgroundColor: isOperatorActive("×") ? "#ffffff" : "#ff9f0a",
                color: isOperatorActive("×") ? "#ff9f0a" : "#ffffff",
                fontSize: "1.75rem",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              ×
            </button>
          </div>

          {/* Row 3: 4, 5, 6, - */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
            <button
              onClick={() => inputDigit("4")}
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                border: "none",
                backgroundColor: "#333333",
                color: "#ffffff",
                fontSize: "1.75rem",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              4
            </button>
            <button
              onClick={() => inputDigit("5")}
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                border: "none",
                backgroundColor: "#333333",
                color: "#ffffff",
                fontSize: "1.75rem",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              5
            </button>
            <button
              onClick={() => inputDigit("6")}
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                border: "none",
                backgroundColor: "#333333",
                color: "#ffffff",
                fontSize: "1.75rem",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              6
            </button>
            <button
              onClick={() => handleOperator("-")}
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                border: "none",
                backgroundColor: isOperatorActive("-") ? "#ffffff" : "#ff9f0a",
                color: isOperatorActive("-") ? "#ff9f0a" : "#ffffff",
                fontSize: "1.75rem",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              -
            </button>
          </div>

          {/* Row 4: 1, 2, 3, + */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
            <button
              onClick={() => inputDigit("1")}
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                border: "none",
                backgroundColor: "#333333",
                color: "#ffffff",
                fontSize: "1.75rem",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              1
            </button>
            <button
              onClick={() => inputDigit("2")}
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                border: "none",
                backgroundColor: "#333333",
                color: "#ffffff",
                fontSize: "1.75rem",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              2
            </button>
            <button
              onClick={() => inputDigit("3")}
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                border: "none",
                backgroundColor: "#333333",
                color: "#ffffff",
                fontSize: "1.75rem",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              3
            </button>
            <button
              onClick={() => handleOperator("+")}
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                border: "none",
                backgroundColor: isOperatorActive("+") ? "#ffffff" : "#ff9f0a",
                color: isOperatorActive("+") ? "#ff9f0a" : "#ffffff",
                fontSize: "1.75rem",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              +
            </button>
          </div>

          {/* Row 5: 0, ., = */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
            <button
              onClick={() => inputDigit("0")}
              style={{
                width: "156px",
                height: "72px",
                borderRadius: "36px",
                border: "none",
                backgroundColor: "#333333",
                color: "#ffffff",
                fontSize: "1.75rem",
                fontWeight: "500",
                cursor: "pointer",
                paddingLeft: "28px",
                textAlign: "left",
              }}
            >
              0
            </button>
            <button
              onClick={inputDecimal}
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                border: "none",
                backgroundColor: "#333333",
                color: "#ffffff",
                fontSize: "1.75rem",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              .
            </button>
            <button
              onClick={handleEquals}
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                border: "none",
                backgroundColor: "#ff9f0a",
                color: "#ffffff",
                fontSize: "1.75rem",
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
