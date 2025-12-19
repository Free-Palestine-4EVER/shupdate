"use client"

// Simple encryption using a shared secret key
// This ensures Firebase never sees plaintext, but all users can decrypt all messages

// ==== KEY OBFUSCATION ====
// The real key is split and encoded to make it hard to find

// Decoy keys (fake - to confuse attackers)
const _k1 = "FakeKey123!DoNotUse"
const _k2 = "AnotherDecoy#456"
const _secureToken = "NotTheRealKey789"

// Real key parts (split up and reversed)
const _p1 = "tahCpuhS" // "ShupChat" reversed
const _p2 = "42024" // "4202" + extra
const _p3 = "!yeKterceS" // "SecretKey!" reversed

// XOR mask for additional obfuscation
const _mask = [0x23, 0x24, 0x25, 0x5e, 0x26, 0x2a, 0x28, 0x29]

// Decoy function (does nothing useful)
function _generateFakeKey(): string {
    return btoa(_k1 + _k2 + Date.now())
}

// Real key assembly function
function _assembleKey(): string {
    // Reverse the parts back
    const part1 = _p1.split("").reverse().join("")
    const part2 = _p2.substring(0, 4)
    const part3 = _p3.split("").reverse().join("")

    // Combine: ShupChat + 2024 + SecretKey! + mask characters
    const maskStr = String.fromCharCode(..._mask)
    return part1 + part2 + part3 + maskStr
}

// Decoy: never called but looks important
const _masterKey = _generateFakeKey()

// Get the real shared secret (assembled at runtime)
function getSharedSecret(): string {
    // This looks like it uses _masterKey but actually doesn't
    if (typeof window === "undefined") return _assembleKey()
    return _assembleKey()
}

// Derive a crypto key from the shared secret
async function getSharedKey(): Promise<CryptoKey> {
    const encoder = new TextEncoder()
    const keyData = encoder.encode(getSharedSecret())

    // Hash the secret to get a proper key length
    const hashBuffer = await crypto.subtle.digest("SHA-256", keyData)

    return crypto.subtle.importKey(
        "raw",
        hashBuffer,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"]
    )
}

// Encrypt a message
export async function encryptWithSharedKey(plaintext: string): Promise<{
    ciphertext: string
    iv: string
}> {
    const key = await getSharedKey()
    const encoder = new TextEncoder()
    const data = encoder.encode(plaintext)

    // Generate random IV for each message
    const iv = crypto.getRandomValues(new Uint8Array(12))

    const encryptedBuffer = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        data
    )

    return {
        ciphertext: btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer))),
        iv: btoa(String.fromCharCode(...iv))
    }
}

// Decrypt a message
export async function decryptWithSharedKey(ciphertext: string, ivBase64: string): Promise<string> {
    try {
        const key = await getSharedKey()
        const encryptedData = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0))
        const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0))

        const decryptedBuffer = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            key,
            encryptedData
        )

        const decoder = new TextDecoder()
        return decoder.decode(decryptedBuffer)
    } catch (error) {
        console.error("Decryption failed:", error)
        return "[Unable to decrypt message]"
    }
}
