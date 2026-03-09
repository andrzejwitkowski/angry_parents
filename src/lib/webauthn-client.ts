import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { generateRSAKeyPair, deriveMasterKey, wrapPrivateKey, unwrapPrivateKey, bytesToBase64 } from "./crypto-utils";
import { savePrivateKey } from "./idb-crypto";
import { authApi, type Gender } from "./api/auth";

export const webauthnClientDeps = {
    generateRSAKeyPair,
    deriveMasterKey,
    wrapPrivateKey,
    unwrapPrivateKey,
    bytesToBase64,
};

export const isPrfSupported = async () => {
    if (!window.PublicKeyCredential) return false;
    try {
        // @ts-ignore
        const caps = await window.PublicKeyCredential.getClientCapabilities?.();
        return !!caps?.["prf"] || !!caps?.["extension:prf"];
    } catch (e) {
        const uvpa = (window as any).PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable;
        if (typeof uvpa === "function") {
            return !!(await uvpa());
        }
        return false;
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

    const options = await authApi.registerOptions({ email, name, username, gender });

    const salt = window.crypto.getRandomValues(new Uint8Array(32));
    const optionsWithPrf = options as any;
    optionsWithPrf.extensions = {
        ...(optionsWithPrf.extensions || {}),
        prf: { eval: { first: salt } }
    };

    let registrationResponse;
    try {
        registrationResponse = await startRegistration({ optionsJSON: optionsWithPrf });
    } catch (error: unknown) {
        if (error instanceof Error && error.name === 'InvalidStateError') {
            throw new Error('Authenticator was probably already registered by this user');
        }
        throw error;
    }

    const { publicKeyBase64, privateKey: extractablePrivateKey } = await webauthnClientDeps.generateRSAKeyPair();

    const prfResults = (registrationResponse as any).clientExtensionResults?.prf;
    if (!prfResults || !prfResults.results?.first) {
        console.warn("PRF extension not returned by authenticator - device might not support PRF. Registration cannot continue without PRF support.");
        throw new Error("Your YubiKey/Browser does not support the required PRF encryption extension.");
    }

    const masterKey = await webauthnClientDeps.deriveMasterKey(new Uint8Array(prfResults.results.first));
    const encryptedRsaPrivateKeyBase64 = await webauthnClientDeps.wrapPrivateKey(extractablePrivateKey, masterKey);

    const privateKeyArrayBuffer = await window.crypto.subtle.exportKey("pkcs8", extractablePrivateKey);
    const nonExtractablePrivateKey = await window.crypto.subtle.importKey(
        "pkcs8",
        privateKeyArrayBuffer,
        {
            name: "RSA-OAEP",
            hash: "SHA-256",
        },
        false,
        ["decrypt", "unwrapKey"]
    );

    const prfSaltBase64 = await webauthnClientDeps.bytesToBase64(salt);

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
        let resp = await fetch(`/api/auth/webauthn/status`, { credentials: 'include' });
        if (!resp.ok && resp.status === 404) {
            resp = await fetch(`/api/auth/status`, { credentials: 'include' });
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
    const verifyResp = await fetch(`/api/auth/webauthn/register/verify`, {
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
    const optionsResp = await fetch(`/api/auth/webauthn/register/options`, { credentials: 'include' });
    if (!optionsResp.ok) {
        const err = await optionsResp.json().catch(() => ({ message: "Failed to get registration options" }));
        throw new Error(err.message || "Failed to get registration options");
    }
    const options = await optionsResp.json();

    const salt = window.crypto.getRandomValues(new Uint8Array(32));
    const optionsWithPrf = options as any;
    optionsWithPrf.extensions = {
        ...(optionsWithPrf.extensions || {}),
        prf: { eval: { first: salt } }
    };

    let registrationResponse;
    try {
        registrationResponse = await startRegistration({ optionsJSON: optionsWithPrf });
    } catch (error: unknown) {
        if (error instanceof Error && error.name === 'InvalidStateError') {
            throw new Error('Authenticator was probably already registered by this user');
        }
        throw error;
    }

    const { publicKeyBase64, privateKey: extractablePrivateKey } = await webauthnClientDeps.generateRSAKeyPair();

    const prfResults = (registrationResponse as any).clientExtensionResults?.prf;
    if (!prfResults || !prfResults.results?.first) {
        throw new Error("Your YubiKey/Browser does not support the required PRF encryption extension.");
    }

    const masterKey = await webauthnClientDeps.deriveMasterKey(new Uint8Array(prfResults.results.first));
    const encryptedRsaPrivateKeyBase64 = await webauthnClientDeps.wrapPrivateKey(extractablePrivateKey, masterKey);

    const privateKeyArrayBuffer = await window.crypto.subtle.exportKey("pkcs8", extractablePrivateKey);
    const nonExtractablePrivateKey = await window.crypto.subtle.importKey(
        "pkcs8",
        privateKeyArrayBuffer,
        {
            name: "RSA-OAEP",
            hash: "SHA-256",
        },
        false,
        ["decrypt", "unwrapKey"]
    );

    const prfSaltBase64 = await webauthnClientDeps.bytesToBase64(salt);

    const verifyResp = await fetch(`/api/auth/webauthn/register/verify`, {
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

    await authApi.updatePublicKey({
        rsaPublicKeyBase64: publicKeyBase64,
        encryptedRsaPrivateKeyBase64,
        prfSaltBase64,
    });

    const me = await authApi.getMe();
    if (me?.user?.id) {
        await savePrivateKey(me.user.id, nonExtractablePrivateKey);
    }

    return true;
};

export const loginWithPasskey = async (email?: string) => {
    const options = await authApi.loginOptions({ email });
    const { prfSaltBase64: _ignoredPrfSaltBase64, ...authenticationOptions } = options as any;

    let authenticationResponse;
    try {
        authenticationResponse = await startAuthentication({ optionsJSON: authenticationOptions });
    } catch (error: unknown) {
        if (error instanceof Error) {
            throw new Error(`Authentication failed: ${error.message}`);
        }
        throw error;
    }

    const result = await authApi.loginVerify({
        email: email || "",
        authenticationResponse
    });

    if (!result.verified) {
        return false;
    }

    const requiresPrivateKeyRestore = Boolean(
        result.encryptedRsaPrivateKeyBase64 || result.prfSaltBase64
    );

    if (!requiresPrivateKeyRestore) {
        return true;
    }

    if (!result.encryptedRsaPrivateKeyBase64 || !result.prfSaltBase64 || !result.userId) {
        console.error("[Auth] Login succeeded but key restoration payload is incomplete.");
        return false;
    }

    try {
        const prfResults = (authenticationResponse as any).clientExtensionResults?.prf;
        if (!prfResults?.results?.first) {
            console.error("[Auth] Login succeeded but PRF results were missing.");
            return false;
        }

        const masterKey = await webauthnClientDeps.deriveMasterKey(new Uint8Array(prfResults.results.first));
        const privateKey = await webauthnClientDeps.unwrapPrivateKey(result.encryptedRsaPrivateKeyBase64, masterKey, false);
        await savePrivateKey(result.userId, privateKey);
        console.log(`[Auth] Successfully decrypted and stored RSA private key for ${result.userId} from YubiKey PRF.`);
        return true;
    } catch (e) {
        console.error("[Auth] Failed to decrypt RSA private key during login:", e);
        return false;
    }
};
