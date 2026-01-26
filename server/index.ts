import { auth } from "../src/lib/auth";

const server = Bun.serve({
    port: 3000,
    async fetch(req) {
        const res = await auth.handler(req);

        // Add CORS headers to all responses
        res.headers.set("Access-Control-Allow-Origin", "http://localhost:5173");
        res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PATCH, DELETE");
        res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
        res.headers.set("Access-Control-Allow-Credentials", "true");

        // Handle preflight requests
        if (req.method === "OPTIONS") {
            return new Response(null, {
                headers: res.headers
            });
        }

        return res;
    },
});

console.log(`Auth server running at http://localhost:${server.port}`);
