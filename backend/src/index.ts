import { Elysia } from "elysia";
import { auth } from "./lib/auth";
import { InMemoryTimelineRepository } from "./adapters/secondary/InMemoryTimelineRepository";
import { TimelineServiceImpl } from "./application/TimelineService";
import { createTimelineController } from "./adapters/primary/TimelineController";

// Dependency Injection - Composition Root
const timelineRepository = new InMemoryTimelineRepository();
const timelineService = new TimelineServiceImpl(timelineRepository);
const timelineController = createTimelineController(timelineService);

import { InMemoryCustodyRepository } from "./adapters/secondary/InMemoryCustodyRepository";
import { createCustodyController } from "./adapters/primary/CustodyController";
const custodyRepository = new InMemoryCustodyRepository();
const custodyController = createCustodyController(custodyRepository);

import { cors } from "@elysiajs/cors";

// Create Elysia app
const app = new Elysia()
    .use(cors({
        origin: "http://localhost:5173",
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization"],
        methods: ["GET", "POST", "OPTIONS", "PATCH", "DELETE"]
    }))
    // Mount timeline controller (already has /api prefix)
    .use(timelineController)
    .use(custodyController)
    // Mount better-auth handler with a more robust catch-all
    .all("/api/auth/*", async ({ request, path }) => {
        // Log for debugging (optional, can be removed once verified)
        // console.log(`Auth request: ${request.method} ${path}`);
        return await auth.handler(request);
    })
    .get("/api/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))
    .listen({
        port: 3000,
        hostname: "0.0.0.0" // Ensure it's reachable
    });

console.log(`🚀 Server running at ${app.server?.hostname}:${app.server?.port}`);
console.log(`   - Auth API: /api/auth/*`);
console.log(`   - Timeline API: /api/timeline, /api/calendar/:date/timeline`);
console.log(`   - Health Check: /api/health`);
console.log(`   - Custody API: /api/custody`);
