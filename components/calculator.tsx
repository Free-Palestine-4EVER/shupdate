"use client"

import type React from "react"

import { useState } from "react"

export default function Calculator() {
  const [display, setDisplay] = useState("0")
  const [previousValue, setPreviousValue] = useState<number | null>(null)
  const [operator, setOperator] = useState<string | null>(null)
  const [waitingForOperand, setWaitingForOperand] = useState(false)

  const inputDigit = (digit: string) => {
    if (waitingForOperand) {
      setDisplay(digit)
      setWaitingForOperand(false)
    } else {
      setDisplay(display === "0" ? digit : display + digit)
    }
  }

  const inputDecimal = () => {
    if (waitingForOperand) {
      setDisplay("0.")
      setWaitingForOperand(false)
      return
    }
    if (!display.includes(".")) {
      setDisplay(display + ".")
    }
  }

  const clear = () => {
    setDisplay("0")
    setPreviousValue(null)
    setOperator(null)
    setWaitingForOperand(false)
  }

  const toggleSign = () => {
    setDisplay(display.charAt(0) === "-" ? display.slice(1) : "-" + display)
  }

  const inputPercent = () => {
    const value = Number.parseFloat(display)
    setDisplay(String(value / 100))
  }

  const performOperation = (nextOperator: string) => {
    const inputValue = Number.parseFloat(display)

    if (previousValue === null) {
      setPreviousValue(inputValue)
    } else if (operator) {
      const currentValue = previousValue || 0
      let result: number

      switch (operator) {
        case "+":
          result = currentValue + inputValue
          break
        case "-":
          result = currentValue - inputValue
          break
        case "×":
          result = currentValue * inputValue
          break
        case "÷":
          result = currentValue / inputValue
          break
        default:
          result = inputValue
      }

      setDisplay(String(result))
      setPreviousValue(result)
    }

    setWaitingForOperand(true)
    setOperator(nextOperator)
  }

  const calculate = () => {
    if (!operator || previousValue === null) return

    const inputValue = Number.parseFloat(display)
    let result: number

    switch (operator) {
      case "+":
        result = previousValue + inputValue
        break
      case "-":
        result = previousValue - inputValue
        break
      case "×":
        result = previousValue * inputValue
        break
      case "÷":
        result = previousValue / inputValue
        break
      default:
        result = inputValue
    }

    setDisplay(String(result))
    setPreviousValue(null)
    setOperator(null)
    setWaitingForOperand(true)
  }

  // Styles
  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    backgroundColor: "#000",
    padding: "1rem",
  }

  const calculatorStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: "320px",
  }

  const displayStyle: React.CSSProperties = {
    width: "100%",
    textAlign: "right",
    fontSize: "4rem",
    fontWeight: 300,
    color: "#fff",
    padding: "0.5rem 1rem",
    marginBottom: "0.5rem",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "12px",
  }

  const buttonBaseStyle: React.CSSProperties = {
    width: "72px",
    height: "72px",
    borderRadius: "50%",
    fontSize: "1.75rem",
    fontWeight: 500,
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.15s ease",
  }

  const grayButtonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: "#a5a5a5",
    color: "#000",
  }

  const orangeButtonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: "#ff9f0a",
    color: "#fff",
  }

  const darkButtonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: "#333333",
    color: "#fff",
  }

  const zeroButtonStyle: React.CSSProperties = {
    ...darkButtonStyle,
    width: "156px",
    borderRadius: "36px",
    justifyContent: "flex-start",
    paddingLeft: "26px",
  }

  return (
    <div style={containerStyle}>
      <div style={calculatorStyle}>
        <div style={displayStyle}>{display}</div>
        <div style={gridStyle}>
          {/* Row 1 */}
          <button style={grayButtonStyle} onClick={clear}>
            AC
          </button>
          <button style={grayButtonStyle} onClick={toggleSign}>
            +/-
          </button>
          <button style={grayButtonStyle} onClick={inputPercent}>
            %
          </button>
          <button style={orangeButtonStyle} onClick={() => performOperation("÷")}>
            ÷
          </button>

          {/* Row 2 */}
          <button style={darkButtonStyle} onClick={() => inputDigit("7")}>
            7
          </button>
          <button style={darkButtonStyle} onClick={() => inputDigit("8")}>
            8
          </button>
          <button style={darkButtonStyle} onClick={() => inputDigit("9")}>
            9
          </button>
          <button style={orangeButtonStyle} onClick={() => performOperation("×")}>
            ×
          </button>

          {/* Row 3 */}
          <button style={darkButtonStyle} onClick={() => inputDigit("4")}>
            4
          </button>
          <button style={darkButtonStyle} onClick={() => inputDigit("5")}>
            5
          </button>
          <button style={darkButtonStyle} onClick={() => inputDigit("6")}>
            6
          </button>
          <button style={orangeButtonStyle} onClick={() => performOperation("-")}>
            -
          </button>

          {/* Row 4 */}
          <button style={darkButtonStyle} onClick={() => inputDigit("1")}>
            1
          </button>
          <button style={darkButtonStyle} onClick={() => inputDigit("2")}>
            2
          </button>
          <button style={darkButtonStyle} onClick={() => inputDigit("3")}>
            3
          </button>
          <button style={orangeButtonStyle} onClick={() => performOperation("+")}>
            +
          </button>

          {/* Row 5 */}
          <button style={zeroButtonStyle} onClick={() => inputDigit("0")}>
            0
          </button>
          <button style={darkButtonStyle} onClick={inputDecimal}>
            .
          </button>
          <button style={orangeButtonStyle} onClick={calculate}>
            =
          </button>
        </div>
      </div>
    </div>
  )
}
