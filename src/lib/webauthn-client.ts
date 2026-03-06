import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { generateRSAKeyPair, deriveMasterKey, wrapPrivateKey, unwrapPrivateKey } from "./crypto-utils";
import { savePrivateKey } from "./idb-crypto";

const API_BASE = "http://localhost:3000/api/auth";

export const isPrfSupported = () => {
    return !!(window.PublicKeyCredential && (window as any).PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable);
};

export const registerPasskey = async (email?: string) => {
    // 1. Get options
    const url = email ? `${API_BASE}/register/options?email=${encodeURIComponent(email)}` : `${API_BASE}/register/options`;
    const resp = await fetch(url, {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        },
        credentials: 'include'
    });

    if (!resp.ok) {
        throw new Error(`Failed to get registration options: ${resp.statusText}`);
    }

    const options = await resp.json();

    // Generate random salt for PRF during registration
    const salt = window.crypto.getRandomValues(new Uint8Array(32));
    options.extensions = {
        ...options.extensions,
        prf: { eval: { first: salt } }
    };

    // 2. Start registration (Browser prompts user)
    let registrationResponse;
    try {
        registrationResponse = await startRegistration(options);
    } catch (error: unknown) {
        if (error instanceof Error && error.name === 'InvalidStateError') {
            throw new Error('Authenticator was probably already registered by this user');
        }
        throw error;
    }

    // 3. Generate RSA Keypair
    const { publicKeyBase64, privateKey } = await generateRSAKeyPair();

    // 4. Derive Master Key from PRF results
    const prfResults = (registrationResponse as any).clientExtensionResults?.prf;
    if (!prfResults || !prfResults.results?.first) {
        console.warn("PRF extension not returned by authenticator - device might not support PRF. Proceeding without wrapping.");
        // Should we fail or fallback? Based on user rule, we should fail for maximum security.
        throw new Error("Your YubiKey/Browser does not support the required PRF encryption extension.");
    }

    const masterKey = await deriveMasterKey(new Uint8Array(prfResults.results.first));

    // 5. Wrap (Encrypt) RSA Private Key
    const encryptedRsaPrivateKeyBase64 = await wrapPrivateKey(privateKey, masterKey);
    const prfSaltBase64 = btoa(String.fromCharCode(...salt));

    // 6. Verify with server
    const verifyResp = await fetch(`${API_BASE}/register/verify`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            registrationResponse,
            rsaPublicKeyBase64: publicKeyBase64,
            encryptedRsaPrivateKeyBase64,
            prfSaltBase64,
            tempEmail: email
        }),
        credentials: 'include'
    });

    if (!verifyResp.ok) {
        const err = await verifyResp.json().catch(() => ({ message: verifyResp.statusText }));
        throw new Error(err.message || "Verification failed");
    }

    const verificationJSON = await verifyResp.json();

    if (verificationJSON && verificationJSON.verified) {
        // Also save the private key locally for immediate use
        if (verificationJSON.userId) {
            await savePrivateKey(verificationJSON.userId, privateKey);
        }
        return true;
    } else {
        throw new Error("Verification failed on server");
    }
};

export const checkHasPasskey = async () => {
    try {
        const resp = await fetch(`${API_BASE}/status`, { credentials: 'include' });
        if (!resp.ok) return false;
        const data = await resp.json();
        return !!data.hasPasskey;
    } catch (e) {
        console.error("Failed to check passkey status", e);
        return false;
    }
}

export const mockRegisterPasskey = async () => {
    // Generate mock keys for consistency in dev
    const { publicKeyBase64 } = await generateRSAKeyPair();

    const verifyResp = await fetch(`${API_BASE}/register/verify`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            mock: true,
            rsaPublicKeyBase64: publicKeyBase64
        }),
        credentials: 'include'
    });

    if (!verifyResp.ok) {
        throw new Error("Mock verification failed");
    }

    return true;
}

export const loginWithPasskey = async (email?: string) => {
    // 1. Get options (provide email if known to get PRF salt)
    const optionsResp = await fetch(`${API_BASE}/login/options`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        credentials: "include",
    });

    if (!optionsResp.ok) {
        throw new Error("Failed to get login options");
    }

    const options = await optionsResp.json();
    const prfSaltBase64 = options.prfSaltBase64;

    // 2. Start authentication
    let authenticationResponse;
    try {
        authenticationResponse = await startAuthentication(options);
    } catch (error: unknown) {
        if (error instanceof Error) {
            throw new Error(`Authentication failed: ${error.message}`);
        }
        throw error;
    }

    // 3. Verify on server
    const verifyResp = await fetch(`${API_BASE}/login/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authenticationResponse }),
        credentials: "include",
    });

    if (!verifyResp.ok) {
        const err = await verifyResp.json().catch(() => ({ message: verifyResp.statusText }));
        throw new Error(err.message || "Login verification failed");
    }

    const result = await verifyResp.json();

    // 4. If login successful and we have PRF material, decrypt the private key
    if (result.verified && result.encryptedRsaPrivateKeyBase64 && prfSaltBase64) {
        try {
            const prfResults = (authenticationResponse as any).clientExtensionResults?.prf;
            if (prfResults?.results?.first) {
                const masterKey = await deriveMasterKey(new Uint8Array(prfResults.results.first));
                const privateKey = await unwrapPrivateKey(result.encryptedRsaPrivateKeyBase64, masterKey, false);

                // Fetch me to get userId if it's not in result (though result.token might be sufficient if we decode it, or just use getMe)
                // For now assuming result.userId is present (need to update backend to include it)
                const userId = result.userId || "current"; // Will be fixed in next step
                await savePrivateKey(userId, privateKey);
                console.log("[Auth] Successfully decrypted and stored RSA private key from YubiKey PRF.");
            }
        } catch (e) {
            console.error("[Auth] Failed to decrypt RSA private key during login:", e);
        }
    }

    return result.verified;
};
