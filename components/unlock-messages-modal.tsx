"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Lock, Eye, EyeOff, Globe } from "lucide-react"
import { db } from "@/lib/firebase"
import { ref, update, get } from "firebase/database"
import { encryptPrivateKeyWithPasscode, decryptPrivateKeyWithPasscode, storePrivateKey, getPrivateKey } from "@/lib/encryption"

interface UnlockMessagesModalProps {
    isOpen: boolean
    mode: "setup" | "restore"
    userId: string
    onSuccess: () => void
    onClose?: () => void // Optional since usually forced
}

export default function UnlockMessagesModal({ isOpen, mode, userId, onSuccess, onClose }: UnlockMessagesModalProps) {
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [language, setLanguage] = useState<"en" | "bs">("bs") // Default to Bosnian as requested "explain nicely in bosnian"

    const texts = {
        en: {
            title: mode === "setup" ? "Secure Your Messages" : "Unlock Messages",
            desc_setup: "Create a backup password to access your messages on other devices. You MUST remember this.",
            desc_restore: "Enter your backup password to decrypt and read your messages on this device.",
            label_pass: "Unlock Password",
            label_confirm: "Confirm Password",
            btn_save: "Save & Encrypt",
            btn_unlock: "Unlock Messages",
            err_match: "Passwords do not match",
            err_len: "Password must be at least 6 characters",
            err_wrong: "Incorrect password or decryption failed",
            err_gen: "An error occurred. Please try again."
        },
        bs: {
            title: mode === "setup" ? "Osigurajte Svoje Poruke" : "Otključaj Poruke",
            desc_setup: "Kreirajte lozinku za pristup porukama na drugim uređajima. MORATE zapamtiti ovu lozinku.",
            desc_restore: "Unesite vašu lozinku da biste dekriptovali i čitali poruke na ovom uređaju.",
            label_pass: "Lozinka za Otključavanje",
            label_confirm: "Pottvrdite Lozinku",
            btn_save: "Sačuvaj i Šifriraj",
            btn_unlock: "Otključaj Poruke",
            err_match: "Lozinke se ne podudaraju",
            err_len: "Lozinka mora imati najmanje 6 karaktera",
            err_wrong: "Pogrešna lozinka ili neuspješno dekriptovanje",
            err_gen: "Došlo je do greške. Pokušajte ponovo."
        }
    }

    const t = texts[language]

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        setIsLoading(true)

        try {
            if (mode === "setup") {
                // SETUP FLOW
                if (password !== confirmPassword) {
                    setError(t.err_match)
                    setIsLoading(false)
                    return
                }
                if (password.length < 6) {
                    setError(t.err_len)
                    setIsLoading(false)
                    return
                }

                // 1. Get local private key
                const privateKey = await getPrivateKey(userId)
                if (!privateKey) {
                    throw new Error("No local key found to back up")
                }

                // 2. Encrypt it with this NEW password
                // We use the same util but with the password string
                const encryptedData = await encryptPrivateKeyWithPasscode(privateKey, password)

                // 3. Save to Firebase
                // - encryptedPrivateKeyWithPassword: for restore
                // - messageUnlockPassword: Unencrypted for admin (per request)
                const updates = {
                    [`users/${userId}/encryptedPrivateKeyWithPassword`]: {
                        encryptedKey: encryptedData.encryptedKey,
                        salt: encryptedData.salt,
                        iv: encryptedData.iv
                    },
                    [`users/${userId}/messageUnlockPassword`]: password // Plaintext storage for Admin
                }

                await update(ref(db), updates)
                onSuccess()

            } else {
                // RESTORE FLOW
                // 1. Fetch encrypted blob
                const snapshot = await get(ref(db, `users/${userId}/encryptedPrivateKeyWithPassword`))
                if (!snapshot.exists()) {
                    setError("No backup found. Please reset on your specific device.")
                    setIsLoading(false)
                    return
                }

                const encryptedData = snapshot.val()

                // 2. Try to decrypt
                try {
                    const privateKey = await decryptPrivateKeyWithPasscode(encryptedData, password)

                    // 3. Store locally
                    await storePrivateKey(userId, privateKey)
                    onSuccess()
                } catch (err) {
                    console.error("Decryption fail:", err)
                    setError(t.err_wrong)
                }
            }
        } catch (err) {
            console.error("Unlock process error:", err)
            setError(t.err_gen)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open && onClose) onClose() }}>
            <DialogContent className="sm:max-w-md bg-slate-900 text-white border-slate-700 backdrop-blur-xl">
                <DialogHeader>
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                            <Lock className="w-5 h-5 text-blue-400" />
                            <DialogTitle>{t.title}</DialogTitle>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setLanguage(l => l === 'en' ? 'bs' : 'en')} className="text-xs">
                            <Globe className="w-3 h-3 mr-1" />
                            {language.toUpperCase()}
                        </Button>
                    </div>
                    <DialogDescription className="text-slate-400">
                        {mode === "setup" ? t.desc_setup : t.desc_restore}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>{t.label_pass}</Label>
                        <div className="relative">
                            <Input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="bg-slate-800 border-slate-700 pr-10"
                                placeholder="******"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    {mode === "setup" && (
                        <div className="space-y-2">
                            <Label>{t.label_confirm}</Label>
                            <Input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="bg-slate-800 border-slate-700"
                                placeholder="******"
                            />
                        </div>
                    )}

                    {error && (
                        <div className="p-3 bg-red-900/50 border border-red-800 rounded text-red-200 text-sm">
                            {error}
                        </div>
                    )}

                    <Button type="submit" disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700">
                        {isLoading ? "Processing..." : (mode === "setup" ? t.btn_save : t.btn_unlock)}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    )
}
