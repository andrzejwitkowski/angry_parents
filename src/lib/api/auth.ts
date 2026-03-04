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

export interface Family {
    id: string;
    name: string;
    parentIds: string[];
    parentPublicKeys: {
        parentId: string;
        role: Gender;
        rsaPublicKeyBase64: string;
    }[];
}

export const authApi = {
    getInvitation: (token: string) =>
        fetchApi<{ email: string; gender: Gender }>(
            `/register/invitation?token=${token}`
        ),

    registerOptions: (data: { email: string; name: string; username: string; gender: Gender }) =>
        fetchApi<{ challenge: string; tempEmail: string; tempName: string; tempUsername: string; tempGender: Gender }>(
            "/register/options",
            { method: "POST", body: JSON.stringify(data) }
        ),

    registerVerify: (data: { registrationResponse: unknown; tempEmail: string; tempName?: string; tempUsername?: string; tempGender?: Gender; mock?: boolean; token?: string }) =>
        fetchApi<{ verified: boolean; role: string }>(
            "/register/verify",
            { method: "POST", body: JSON.stringify(data) }
        ),

    loginOptions: () =>
        fetchApi<{ challenge: string }>("/login/options", { method: "POST" }),

    loginVerify: (data: { authenticationResponse?: unknown; mockLogin?: boolean; userId?: string }) =>
        fetchApi<{ verified: boolean }>(
            "/login/verify",
            { method: "POST", body: JSON.stringify(data) }
        ),

    getMe: () =>
        fetchApi<{
            user: { id: string; email: string; name: string; gender: Gender };
            family: Family;
            role: string
        }>("/me"),

    logout: () =>
        fetchApi<{ ok: boolean }>("/logout", { method: "POST" }),

    devMockRegister: (data: { email: string; name: string; gender: Gender; token?: string }) =>
        fetchApi<{ verified: boolean; role: string }>(
            "/mock-register",
            { method: "POST", body: JSON.stringify(data) }
        ),

    devMockLogin: (userId?: string) =>
        fetchApi<{ verified: boolean }>(
            "/mock-login",
            { method: "POST", body: JSON.stringify({ userId }) }
        ),
};
