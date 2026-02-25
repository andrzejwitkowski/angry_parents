export class TestApi {
    private baseUrl: string;
    private cookieJar: string = "";

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    async signUp(email: string, password: string, name: string) {
        const res = await fetch(`${this.baseUrl}/api/auth/sign-up/email`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email,
                password,
                name,
                username: name // Map name to username as it is required by auth.ts
            }),
        });
        this.updateCookies(res);
        return res;
    }

    async signIn(email: string, password: string) {
        const res = await fetch(`${this.baseUrl}/api/auth/sign-in/email`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });
        this.updateCookies(res);
        return res;
    }

    async registerMockPasskey(mockCredentialID: string, mockCredentialPublicKey: string) {
        const res = await fetch(`${this.baseUrl}/api/auth/webauthn/register/verify`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Cookie": this.cookieJar
            },
            body: JSON.stringify({
                mock: true,
                mockCredentialID,
                mockCredentialPublicKey
            }),
        });
        this.updateCookies(res);
        return res.json();
    }

    async post(path: string, body: any) {
        const res = await fetch(`${this.baseUrl}${path}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Cookie": this.cookieJar
            },
            body: JSON.stringify(body),
        });
        this.updateCookies(res);
        return res; // Return Response object to check status
    }

    async get(path: string) {
        const res = await fetch(`${this.baseUrl}${path}`, {
            headers: {
                "Cookie": this.cookieJar
            }
        });
        this.updateCookies(res);
        return res;
    }

    async delete(path: string) {
        const res = await fetch(`${this.baseUrl}${path}`, {
            method: "DELETE",
            headers: {
                "Cookie": this.cookieJar
            }
        });
        this.updateCookies(res);
        return res;
    }

    private updateCookies(res: Response) {
        // Use getSetCookie() to get ALL Set-Cookie headers as an array (Bun/modern fetch).
        // Fall back to splitting get("set-cookie") for older runtimes.
        const allCookies: string[] =
            typeof (res.headers as any).getSetCookie === "function"
                ? (res.headers as any).getSetCookie()
                : (res.headers.get("set-cookie") ?? "").split(/,(?=[^ ])/).filter(Boolean);

        if (allCookies.length > 0) {
            // Extract all name=value pairs from all Set-Cookie headers
            const cookies = allCookies.flatMap(c => {
                const parts = c.split(';');
                return parts[0].trim();
            }).filter(Boolean);

            this.cookieJar = cookies.join('; ');
        }
    }
}
