"use client"

// Simple encryption using a shared secret key
// This ensures Firebase never sees plaintext, but all users can decrypt all messages

const SHARED_SECRET = "ShupChat2024SecretKey!@#$%^&*()" // Fixed secret key

// Derive a crypto key from the shared secret
async function getSharedKey(): Promise<CryptoKey> {
    const encoder = new TextEncoder()
    const keyData = encoder.encode(SHARED_SECRET)

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
