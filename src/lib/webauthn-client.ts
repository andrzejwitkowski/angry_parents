import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { generateRSAKeyPair, deriveMasterKey, wrapPrivateKey, unwrapPrivateKey } from "./crypto-utils";
import { savePrivateKey } from "./idb-crypto";
import { authApi, type Gender } from "./api/auth";

const API_BASE = "http://localhost:3000/api/auth";

export const isPrfSupported = async () => {
    if (!window.PublicKeyCredential) return false;
    try {
        // @ts-ignore
        const caps = await window.PublicKeyCredential.getClientCapabilities?.();
        return !!caps?.["prf"] || !!caps?.["extension:prf"];
    } catch (e) {
        // Fallback to basic check if getClientCapabilities is not supported
        return !!(window as any).PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable;
    }
};

export const registerPasskey = async (params: {
    email: string;
    name: string;
    username: string;
    gender: Gender;
    token: string;
}) => {
    const { email, name, username, gender, token } = params;

    // 1. Get options
    const options = await authApi.registerOptions({ email, name, username, gender });

    // Generate random salt for PRF during registration
    const salt = window.crypto.getRandomValues(new Uint8Array(32));
    // @ts-ignore
    options.extensions = {
        ...options.extensions,
        prf: { eval: { first: salt } }
    };

    // 2. Start registration (Browser prompts user)
    let registrationResponse;
    try {
        registrationResponse = await startRegistration({ optionsJSON: options });
    } catch (error: unknown) {
        if (error instanceof Error && error.name === 'InvalidStateError') {
            throw new Error('Authenticator was probably already registered by this user');
        }
        throw error;
    }

    // 3. Generate RSA Keypair
    const { publicKeyBase64, privateKey: extractablePrivateKey } = await generateRSAKeyPair();

    // 4. Derive Master Key from PRF results
    const prfResults = (registrationResponse as any).clientExtensionResults?.prf;
    if (!prfResults || !prfResults.results?.first) {
        console.warn("PRF extension not returned by authenticator - device might not support PRF. Proceeding without wrapping.");
        throw new Error("Your YubiKey/Browser does not support the required PRF encryption extension.");
    }

    const masterKey = await deriveMasterKey(new Uint8Array(prfResults.results.first));

    // 5. Wrap (Encrypt) RSA Private Key while the source key is still extractable.
    const encryptedRsaPrivateKeyBase64 = await wrapPrivateKey(extractablePrivateKey, masterKey);

    // Re-import the key as non-extractable before saving it locally.
    const privateKeyArrayBuffer = await window.crypto.subtle.exportKey("pkcs8", extractablePrivateKey);
    const nonExtractablePrivateKey = await window.crypto.subtle.importKey(
        "pkcs8",
        privateKeyArrayBuffer,
        {
            name: "RSA-OAEP",
            hash: "SHA-256",
        },
        false, // non-extractable
        ["decrypt", "unwrapKey"]
    );

    const prfSaltBase64 = btoa(String.fromCharCode(...salt));

    // 6. Verify with server
    const verificationJSON = await authApi.registerVerify({
        registrationResponse,
        rsaPublicKeyBase64: publicKeyBase64,
        encryptedRsaPrivateKeyBase64,
        prfSaltBase64,
        tempEmail: email,
        tempName: name,
        tempUsername: username,
        tempGender: gender,
        token
    });

    if (verificationJSON && verificationJSON.verified) {
        // Also save the private key locally for immediate use
        if (verificationJSON.userId) {
            await savePrivateKey(verificationJSON.userId, nonExtractablePrivateKey);
        }
        return true;
    } else {
        throw new Error("Verification failed on server");
    }
};

export const checkHasPasskey = async () => {
    try {
        let resp = await fetch(`${API_BASE}/webauthn/status`, { credentials: 'include' });
        if (!resp.ok && resp.status === 404) {
            resp = await fetch(`${API_BASE}/status`, { credentials: 'include' });
        }
        if (!resp.ok) return false;
        const data = await resp.json();
        return !!data.hasPasskey;
    } catch (e) {
        console.error("Failed to check passkey status", e);
        return false;
    }
}

export const mockRegisterPasskey = async () => {
    const verifyResp = await fetch(`${API_BASE}/webauthn/register/verify`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            mock: true,
        }),
        credentials: 'include'
    });

    if (!verifyResp.ok) {
        throw new Error("Mock verification failed");
    }

    return true;
}

export const registerPasskeyForLoggedInUser = async () => {
    const optionsResp = await fetch(`${API_BASE}/webauthn/register/options`, { credentials: 'include' });
    if (!optionsResp.ok) {
        const err = await optionsResp.json().catch(() => ({ message: "Failed to get registration options" }));
        throw new Error(err.message || "Failed to get registration options");
    }
    const options = await optionsResp.json();

    let registrationResponse;
    try {
        registrationResponse = await startRegistration({ optionsJSON: options });
    } catch (error: unknown) {
        if (error instanceof Error && error.name === 'InvalidStateError') {
            throw new Error('Authenticator was probably already registered by this user');
        }
        throw error;
    }

    const verifyResp = await fetch(`${API_BASE}/webauthn/register/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registrationResponse),
        credentials: "include",
    });

    if (!verifyResp.ok) {
        const err = await verifyResp.json().catch(() => ({ message: "Registration verify failed" }));
        throw new Error(err.message || "Registration verify failed");
    }

    const verifyJson = await verifyResp.json();
    if (!verifyJson?.verified) {
        throw new Error("Verification failed on server");
    }

    return true;
};

export const loginWithPasskey = async (email?: string) => {
    // 1. Get options
    const options = await authApi.loginOptions({ email });

    // 2. Start authentication
    let authenticationResponse;
    try {
        authenticationResponse = await startAuthentication({ optionsJSON: options });
    } catch (error: unknown) {
        if (error instanceof Error) {
            throw new Error(`Authentication failed: ${error.message}`);
        }
        throw error;
    }

    // 3. Verify on backend
    const result = await authApi.loginVerify({
        email: email || "",
        authenticationResponse
    });

    // 4. If login successful and we have PRF material, decrypt the private key
    if (result.verified && result.encryptedRsaPrivateKeyBase64 && result.prfSaltBase64) {
        try {
            const prfResults = (authenticationResponse as any).clientExtensionResults?.prf;
            if (prfResults?.results?.first) {
                const masterKey = await deriveMasterKey(new Uint8Array(prfResults.results.first));
                const privateKey = await unwrapPrivateKey(result.encryptedRsaPrivateKeyBase64, masterKey, false);

                // result.userId is now returned by backend
                const userId = result.userId;
                await savePrivateKey(userId, privateKey);
                console.log(`[Auth] Successfully decrypted and stored RSA private key for ${userId} from YubiKey PRF.`);
            }
        } catch (e) {
            console.error("[Auth] Failed to decrypt RSA private key during login:", e);
        }
    }

    return result.verified;
};
