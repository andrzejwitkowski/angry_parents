import { startRegistration } from "@simplewebauthn/browser";

const API_BASE = "http://localhost:3000/api/auth/webauthn";

export const registerPasskey = async () => {
    // 1. Get options
    const resp = await fetch(`${API_BASE}/register/options`, {
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

    // 2. Start registration (Browser prompts user)
    let registrationResponse;
    try {
        registrationResponse = await startRegistration(options);
    } catch (error: any) {
        if (error.name === 'InvalidStateError') {
            throw new Error('Authenticator was probably already registered by this user');
        }
        throw error;
    }

    // 3. Verify
    const verifyResp = await fetch(`${API_BASE}/register/verify`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(registrationResponse),
        credentials: 'include'
    });

    if (!verifyResp.ok) {
        const err = await verifyResp.json().catch(() => ({ message: verifyResp.statusText }));
        throw new Error(err.message || "Verification failed");
    }

    const verificationJSON = await verifyResp.json();

    if (verificationJSON && verificationJSON.verified) {
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
    // Skip browser interaction, go straight to verify with mock payload
    const verifyResp = await fetch(`${API_BASE}/register/verify`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mock: true }),
        credentials: 'include'
    });

    if (!verifyResp.ok) {
        throw new Error("Mock verification failed");
    }

    return true;
}
