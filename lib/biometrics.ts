"use client"

// Utilities for WebAuthn / Biometric Authentication

// Check if platform authenticator (FaceID/TouchID/Windows Hello) is available
export const isBiometricAvailable = async (): Promise<boolean> => {
    if (
        typeof window !== "undefined" &&
        window.PublicKeyCredential &&
        (await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
    ) {
        return true
    }
    return false
}

// Trigger a biometric challenge
// Since we are checking for device presence/owner locally without a server FIDO2 flow,
// we just check if the user can successfully sign a dummy challenge.
export const verifyBiometric = async (): Promise<boolean> => {
    if (!isBiometricAvailable()) {
        throw new Error("Biometrics not supported")
    }

    try {
        const challenge = new Uint8Array(32)
        window.crypto.getRandomValues(challenge)

        // Request a credential assertion
        // We use a dummy ID or just an empty allowList to trigger the "User Verification" flow of the platform
        // However, usually you need to have created a credential first.
        // simpler approach for "Device Unlock":
        // Just create a new credential every time (Registration ceremony) as a proof of presence?
        // No, that asks to "Save a passkey".
        // 
        // Correct approach for local unlock without server:
        // We essentially can't do "True" WebAuthn without a stored credential ID.
        // So we must Register once, store the Credential ID in localStorage, and then Assert against it.

        // Check if we have a stored credential ID
        const storedCredentialId = localStorage.getItem("biometric_credential_id")

        if (!storedCredentialId) {
            // If we don't have one, we can't verify against it.
            // The setup phase must have failed or wasn't done.
            return false
        }

        const credentialId = Uint8Array.from(atob(storedCredentialId), c => c.charCodeAt(0))

        const assertion: any = await navigator.credentials.get({
            publicKey: {
                challenge,
                timeout: 60000,
                userVerification: "required", // Force FaceID/PIN
                allowCredentials: [{
                    id: credentialId,
                    type: "public-key",
                    transports: ["internal"]
                }]
            }
        })

        return !!assertion
    } catch (error) {
        console.error("Biometric verification failed:", error)
        return false
    }
}

// Register a new Biometric Credential (during setup)
// Returns true if successful
export const registerBiometric = async (username: string): Promise<boolean> => {
    try {
        const challenge = new Uint8Array(32)
        window.crypto.getRandomValues(challenge)

        const userId = new Uint8Array(16)
        window.crypto.getRandomValues(userId)

        const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
            challenge,
            rp: {
                name: "Skupoooo Chat",
                // id: window.location.hostname // Optional, defaults to current domain
            },
            user: {
                id: userId,
                name: username,
                displayName: username,
            },
            pubKeyCredParams: [{ alg: -7, type: "public-key" }],
            authenticatorSelection: {
                authenticatorAttachment: "platform", // Force FaceID/TouchID
                userVerification: "required"
            },
            timeout: 60000,
            attestation: "none"
        }

        const credential: any = await navigator.credentials.create({
            publicKey: publicKeyCredentialCreationOptions
        })

        if (credential) {
            // Save the credential ID to verify against later
            // We encode it to base64 string for localStorage
            const rawId = new Uint8Array(credential.rawId)
            const base64Id = btoa(String.fromCharCode(...rawId))
            localStorage.setItem("biometric_credential_id", base64Id)
            localStorage.setItem("biometric_enabled", "true")
            return true
        }
        return false

    } catch (error) {
        console.error("Biometric registration failed:", error)
        return false
    }
}
