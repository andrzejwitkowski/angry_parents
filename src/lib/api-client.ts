const BASE_URL = "http://localhost:3000/api";

export const api = {
    get: async (path: string) => {
        const res = await fetch(`${BASE_URL}${path}`, {
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
        });
        if (!res.ok) throw new Error(`API Error: ${res.status}`);
        return res.json();
    },
    post: async (path: string, body: any) => {
        const res = await fetch(`${BASE_URL}${path}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`API Error: ${res.status}`);
        return res.json();
    }
};
