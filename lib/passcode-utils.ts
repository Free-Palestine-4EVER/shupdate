import { createHash, randomBytes } from "crypto"

// Generate a random salt
export function generateSalt(): string {
  return randomBytes(16).toString("hex")
}

// Hash the passcode with the salt
export function hashPasscode(passcode: string, salt: string): string {
  return createHash("sha256")
    .update(passcode + salt)
    .digest("hex")
}

// Generate salt and hash
export function generatePasscodeHash(passcode: string): { hash: string; salt: string } {
  const salt = generateSalt()
  const hash = hashPasscode(passcode, salt)
  return { hash, salt }
}

// Verify if the entered passcode matches the stored hash
export function verifyPasscode(enteredPasscode: string, storedHash: string, salt: string): boolean {
  const hashedEnteredPasscode = hashPasscode(enteredPasscode, salt)
  return hashedEnteredPasscode === storedHash
}

// Store passcode in localStorage (encrypted version)
export function storePasscodeLocally(userId: string, isEnabled: boolean): void {
  localStorage.setItem(`passcode_enabled_${userId}`, isEnabled.toString())
}

// Check if passcode is enabled locally
export function isPasscodeEnabledLocally(userId: string): boolean {
  return localStorage.getItem(`passcode_enabled_${userId}`) === "true"
}

// Store session verification status
export function setSessionVerified(verified: boolean): void {
  sessionStorage.setItem("session_verified", verified.toString())
}

// Check if the current session has been verified with passcode
export function isSessionVerified(): boolean {
  return sessionStorage.getItem("session_verified") === "true"
}

// Store last app access time
export function updateLastAccessTime(): void {
  localStorage.setItem("last_access_time", Date.now().toString())
}

// Check if passcode should be shown
export function shouldShowPasscode(userId: string): boolean {
  // If session is already verified, don't show passcode
  if (isSessionVerified()) {
    return false
  }

  // Otherwise, we'll check in the component by fetching from Firebase
  return true
}
