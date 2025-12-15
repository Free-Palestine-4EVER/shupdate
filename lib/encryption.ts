"use client"

// E2E Encryption utilities using Web Crypto API
// Uses hybrid encryption: RSA-OAEP for key exchange, AES-GCM for message content

const ADMIN_USER_ID = "zzzz"

// IndexedDB storage for private keys
const DB_NAME = "chat_encryption"
const STORE_NAME = "keys"

async function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve(request.result)
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "id" })
            }
        }
    })
}

// Generate RSA key pair for a user
export async function generateKeyPair(): Promise<{
    publicKey: string
    privateKey: CryptoKey
}> {
    const keyPair = await crypto.subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256",
        },
        true,
        ["encrypt", "decrypt"]
    )

    // Export public key as base64
    const publicKeyBuffer = await crypto.subtle.exportKey("spki", keyPair.publicKey)
    const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyBuffer)))

    return {
        publicKey: publicKeyBase64,
        privateKey: keyPair.privateKey,
    }
}

// Store private key in IndexedDB
export async function storePrivateKey(userId: string, privateKey: CryptoKey): Promise<void> {
    const db = await openDB()
    const exportedKey = await crypto.subtle.exportKey("pkcs8", privateKey)

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readwrite")
        const store = transaction.objectStore(STORE_NAME)
        const request = store.put({
            id: userId,
            key: Array.from(new Uint8Array(exportedKey))
        })
        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve()
    })
}

// Get private key from IndexedDB
export async function getPrivateKey(userId: string): Promise<CryptoKey | null> {
    try {
        const db = await openDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], "readonly")
            const store = transaction.objectStore(STORE_NAME)
            const request = store.get(userId)

            request.onerror = () => reject(request.error)
            request.onsuccess = async () => {
                if (!request.result) {
                    resolve(null)
                    return
                }

                const keyData = new Uint8Array(request.result.key).buffer
                const privateKey = await crypto.subtle.importKey(
                    "pkcs8",
                    keyData,
                    { name: "RSA-OAEP", hash: "SHA-256" },
                    true,
                    ["decrypt"]
                )
                resolve(privateKey)
            }
        })
    } catch (error) {
        console.error("Error getting private key:", error)
        return null
    }
}

// Import a public key from base64 string
export async function importPublicKey(publicKeyBase64: string): Promise<CryptoKey> {
    const publicKeyBuffer = Uint8Array.from(atob(publicKeyBase64), c => c.charCodeAt(0))

    return crypto.subtle.importKey(
        "spki",
        publicKeyBuffer,
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["encrypt"]
    )
}

// Generate a random AES key for message encryption
async function generateAESKey(): Promise<CryptoKey> {
    return crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    )
}

// Encrypt message with recipient's public key (hybrid encryption)
export async function encryptMessage(
    plaintext: string,
    recipientPublicKeyBase64: string,
    adminPublicKeyBase64?: string
): Promise<{
    encryptedText: string
    encryptedKey: string
    iv: string
    encryptedTextAdmin?: string
    encryptedKeyAdmin?: string
    ivAdmin?: string
}> {
    // Generate random AES key for this message
    const aesKey = await generateAESKey()

    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(12))

    // Encrypt the message with AES-GCM
    const encoder = new TextEncoder()
    const plaintextBuffer = encoder.encode(plaintext)
    const encryptedBuffer = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        aesKey,
        plaintextBuffer
    )

    // Export AES key
    const aesKeyBuffer = await crypto.subtle.exportKey("raw", aesKey)

    // Encrypt AES key with recipient's RSA public key
    const recipientPublicKey = await importPublicKey(recipientPublicKeyBase64)
    const encryptedAESKey = await crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        recipientPublicKey,
        aesKeyBuffer
    )

    const result: {
        encryptedText: string
        encryptedKey: string
        iv: string
        encryptedTextAdmin?: string
        encryptedKeyAdmin?: string
        ivAdmin?: string
    } = {
        encryptedText: btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer))),
        encryptedKey: btoa(String.fromCharCode(...new Uint8Array(encryptedAESKey))),
        iv: btoa(String.fromCharCode(...iv)),
    }

    // Also encrypt for admin if admin public key is provided
    if (adminPublicKeyBase64) {
        const adminPublicKey = await importPublicKey(adminPublicKeyBase64)
        const encryptedAESKeyAdmin = await crypto.subtle.encrypt(
            { name: "RSA-OAEP" },
            adminPublicKey,
            aesKeyBuffer
        )

        // Same encrypted content, just different key encryption
        result.encryptedTextAdmin = result.encryptedText
        result.encryptedKeyAdmin = btoa(String.fromCharCode(...new Uint8Array(encryptedAESKeyAdmin)))
        result.ivAdmin = result.iv
    }

    return result
}

// Decrypt message with private key
export async function decryptMessage(
    encryptedText: string,
    encryptedKey: string,
    ivBase64: string,
    privateKey: CryptoKey
): Promise<string> {
    try {
        // Decode from base64
        const encryptedBuffer = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0))
        const encryptedAESKey = Uint8Array.from(atob(encryptedKey), c => c.charCodeAt(0))
        const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0))

        // Decrypt AES key with private RSA key
        const aesKeyBuffer = await crypto.subtle.decrypt(
            { name: "RSA-OAEP" },
            privateKey,
            encryptedAESKey
        )

        // Import AES key
        const aesKey = await crypto.subtle.importKey(
            "raw",
            aesKeyBuffer,
            { name: "AES-GCM" },
            false,
            ["decrypt"]
        )

        // Decrypt message
        const decryptedBuffer = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            aesKey,
            encryptedBuffer
        )

        const decoder = new TextDecoder()
        return decoder.decode(decryptedBuffer)
    } catch (error) {
        console.error("Decryption failed:", error)
        return "[Unable to decrypt message]"
    }
}

// Check if user has encryption keys
export async function hasEncryptionKeys(userId: string): Promise<boolean> {
    const privateKey = await getPrivateKey(userId)
    return privateKey !== null
}

// Helper to get admin user ID
export function getAdminUserId(): string {
    return ADMIN_USER_ID
}

// ============================================
// PASSCODE-PROTECTED KEY ENCRYPTION
// ============================================

const PBKDF2_ITERATIONS = 100000 // High iterations to slow brute force

// Derive encryption key from passcode using PBKDF2
async function deriveKeyFromPasscode(passcode: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder()
    const passcodeBuffer = encoder.encode(passcode)

    // Import passcode as key material
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        passcodeBuffer,
        "PBKDF2",
        false,
        ["deriveKey"]
    )

    // Derive AES key from passcode
    return crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt.buffer as ArrayBuffer,
            iterations: PBKDF2_ITERATIONS,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    )
}

// Encrypt private key with passcode
export async function encryptPrivateKeyWithPasscode(
    privateKey: CryptoKey,
    passcode: string
): Promise<{ encryptedKey: number[], salt: number[], iv: number[] }> {
    // Generate random salt and IV
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const iv = crypto.getRandomValues(new Uint8Array(12))

    // Derive encryption key from passcode
    const derivedKey = await deriveKeyFromPasscode(passcode, salt)

    // Export private key
    const privateKeyBuffer = await crypto.subtle.exportKey("pkcs8", privateKey)

    // Encrypt private key with derived key
    const encryptedBuffer = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        derivedKey,
        privateKeyBuffer
    )

    return {
        encryptedKey: Array.from(new Uint8Array(encryptedBuffer)),
        salt: Array.from(salt),
        iv: Array.from(iv)
    }
}

// Decrypt private key with passcode
export async function decryptPrivateKeyWithPasscode(
    encryptedData: { encryptedKey: number[], salt: number[], iv: number[] },
    passcode: string
): Promise<CryptoKey> {
    const salt = new Uint8Array(encryptedData.salt)
    const iv = new Uint8Array(encryptedData.iv)
    const encryptedBuffer = new Uint8Array(encryptedData.encryptedKey)

    // Derive decryption key from passcode
    const derivedKey = await deriveKeyFromPasscode(passcode, salt)

    // Decrypt private key
    const decryptedBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        derivedKey,
        encryptedBuffer
    )

    // Import as CryptoKey
    return crypto.subtle.importKey(
        "pkcs8",
        decryptedBuffer,
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["decrypt"]
    )
}

// Store encrypted private key (protected by passcode)
export async function storeEncryptedPrivateKey(
    userId: string,
    encryptedData: { encryptedKey: number[], salt: number[], iv: number[] }
): Promise<void> {
    const db = await openDB()

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readwrite")
        const store = transaction.objectStore(STORE_NAME)
        const request = store.put({
            id: userId,
            encryptedKey: encryptedData.encryptedKey,
            salt: encryptedData.salt,
            iv: encryptedData.iv,
            isEncrypted: true
        })
        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve()
    })
}

// Get encrypted private key data
export async function getEncryptedPrivateKeyData(userId: string): Promise<{
    encryptedKey: number[]
    salt: number[]
    iv: number[]
} | null> {
    try {
        const db = await openDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], "readonly")
            const store = transaction.objectStore(STORE_NAME)
            const request = store.get(userId)

            request.onerror = () => reject(request.error)
            request.onsuccess = () => {
                if (!request.result || !request.result.isEncrypted) {
                    resolve(null)
                    return
                }
                resolve({
                    encryptedKey: request.result.encryptedKey,
                    salt: request.result.salt,
                    iv: request.result.iv
                })
            }
        })
    } catch (error) {
        console.error("Error getting encrypted key data:", error)
        return null
    }
}

// Clear all encryption keys (for account wipe)
export async function clearAllKeys(): Promise<void> {
    try {
        const db = await openDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], "readwrite")
            const store = transaction.objectStore(STORE_NAME)
            const request = store.clear()
            request.onerror = () => reject(request.error)
            request.onsuccess = () => resolve()
        })
    } catch (error) {
        console.error("Error clearing keys:", error)
    }
}
