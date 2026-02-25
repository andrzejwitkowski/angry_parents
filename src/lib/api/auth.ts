const API_BASE = "/api/auth";

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...options.headers,
        },
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Request failed" }));
        throw new Error(error.message || `HTTP ${res.status}`);
    }

    return res.json();
}

export type Gender = "mom" | "dad";

export const authApi = {
    registerParentAOptions: (data: { email: string; name: string; username: string; gender: Gender }) =>
        fetchApi<{ challenge: string; tempEmail: string; tempName: string; tempUsername: string; tempGender: Gender }>(
            "/register/parent-a/options",
            { method: "POST", body: JSON.stringify(data) }
        ),

    registerParentAVerify: (data: { registrationResponse: unknown; tempEmail: string; tempName?: string; tempUsername?: string; tempGender?: Gender; mock?: boolean }) =>
        fetchApi<{ verified: boolean; role: string }>(
            "/register/parent-a/verify",
            { method: "POST", body: JSON.stringify(data) }
        ),

    registerParentBOptions: (token: string) =>
        fetchApi<{ challenge: string; tempToken: string; tempFamilyId: string; tempCreatedByGender: Gender }>(
            `/register/parent-b/options?token=${token}`
        ),

    registerParentBVerify: (data: { registrationResponse?: unknown; tempToken: string; tempFamilyId: string; tempCreatedByGender: Gender; gender: Gender; mock?: boolean }) =>
        fetchApi<{ verified: boolean; role: string }>(
            "/register/parent-b/verify",
            { method: "POST", body: JSON.stringify(data) }
        ),

    invite: (email: string) =>
        fetchApi<{ token: string; link: string }>(
            "/invite",
            { method: "POST", body: JSON.stringify({ email }) }
        ),

    loginOptions: () =>
        fetchApi<{ challenge: string }>("/login/options", { method: "POST" }),

    loginVerify: (data: { authenticationResponse?: unknown; mockLogin?: boolean; userId?: string }) =>
        fetchApi<{ verified: boolean }>(
            "/login/verify",
            { method: "POST", body: JSON.stringify(data) }
        ),

    getMe: () =>
        fetchApi<{ user: { id: string; email: string; name: string; gender: Gender }; family: unknown; role: string }>("/me"),

    logout: () =>
        fetchApi<{ ok: boolean }>("/logout", { method: "POST" }),

    devMockRegisterA: (data: { email: string; name: string; gender: Gender }) =>
        fetchApi<{ verified: boolean; role: string }>(
            "/mock-register-a",
            { method: "POST", body: JSON.stringify(data) }
        ),

    devMockRegisterB: (data: { token: string; gender: Gender }) =>
        fetchApi<{ verified: boolean; role: string }>(
            "/mock-register-b",
            { method: "POST", body: JSON.stringify(data) }
        ),

    devMockLogin: (userId?: string) =>
        fetchApi<{ verified: boolean }>(
            "/mock-login",
            { method: "POST", body: JSON.stringify({ userId }) }
        ),
};
