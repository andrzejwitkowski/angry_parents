import { Elysia } from "elysia";
import mongoose from "mongoose";
import { taskManager } from "./scheduler/instance";
import { TaskType } from "./scheduler/types";
import { createSyncUserPendingDocsHandler } from "./scheduler/handlers/SyncUserPendingDocs";
import { createProcessDocumentIntegrityHandler } from "./scheduler/handlers/ProcessDocumentIntegrity";
import { createBlockchainPublishHandler } from "./scheduler/handlers/BlockchainPublish";
import { MongoForensicRepository } from "./adapters/secondary/MongoForensicRepository";
import { BunCryptoService } from "./adapters/secondary/BunCryptoService";
import { ViemBlockchainAnchor } from "./adapters/secondary/ViemBlockchainAnchor";
import { auth } from "./lib/auth";
import { ForensicService } from "./application/ForensicService";
import { forensicController as createForensicController } from "./adapters/primary/ForensicController";
import { InMemoryTimelineRepository } from "./adapters/secondary/InMemoryTimelineRepository";
import { TimelineServiceImpl } from "./application/TimelineService";
import { createTimelineController } from "./adapters/primary/TimelineController";
import { RealDateProvider } from "./adapters/secondary/RealDateProvider";
import { RealUuidProvider } from "./adapters/secondary/RealUuidProvider";

const dateProvider = new RealDateProvider();
const uuidProvider = new RealUuidProvider();

// Dependency Injection - Composition Root
const timelineRepository = new InMemoryTimelineRepository();
const timelineService = new TimelineServiceImpl(timelineRepository, dateProvider, uuidProvider);
const timelineController = createTimelineController(timelineService);

import { InMemoryCustodyRepository } from "./adapters/secondary/InMemoryCustodyRepository";
import { createCustodyController } from "./adapters/primary/CustodyController";
import { InMemoryScheduleRepository } from "./adapters/secondary/InMemoryScheduleRepository";
import { ScheduleService } from "./application/ScheduleService";

import { PropagationService } from "./application/PropagationService";

const custodyRepository = new InMemoryCustodyRepository();
const scheduleRepository = new InMemoryScheduleRepository();
const scheduleService = new ScheduleService(scheduleRepository, custodyRepository, dateProvider, uuidProvider);
const propagationService = new PropagationService(scheduleRepository);
const custodyController = createCustodyController(custodyRepository, scheduleService, propagationService, uuidProvider);

import { InMemoryChildRepository } from "./adapters/secondary/InMemoryChildRepository";
import { ChildService } from "./application/ChildService";
import { createChildController } from "./adapters/primary/ChildController";

const childRepository = new InMemoryChildRepository();
const childService = new ChildService(childRepository, timelineRepository, uuidProvider);
const childController = createChildController(childService);

import { InMemoryPasskeyRepository } from "./adapters/secondary/InMemoryPasskeyRepository";
import { createWebAuthnController } from "./adapters/primary/WebAuthnController";

const passkeyRepository = new InMemoryPasskeyRepository();
const webAuthnController = createWebAuthnController(passkeyRepository, dateProvider);

// --- Task Scheduler & Forensic Pipeline Setup ---
// Ensure MongoDB connection (required for TaskManager and ForensicRepo)
try {
    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/angry_parents";
    await mongoose.connect(mongoUri);
    console.log("[MongoDB] Connected");
} catch (e) {
    console.warn("[MongoDB] Connection failed, Task Scheduler may not function:", e);
}

// Initialize Secondary Adapters for Pipeline
if (!mongoose.connection.db) {
    throw new Error("MongoDB connection not established");
}
const forensicRepository = new MongoForensicRepository(mongoose.connection.db);
const cryptoService = new BunCryptoService();
// Use Mock for now to avoid gas fees/RPC issues in E2E
// const blockchainAnchor = new ViemBlockchainAnchor();
import { MockBlockchainAnchor } from "./adapters/secondary/MockBlockchainAnchor";
const blockchainAnchor = new MockBlockchainAnchor();

const forensicService = new ForensicService(forensicRepository, blockchainAnchor, cryptoService, taskManager);
const forensicController = createForensicController({ forensicService, forensicRepository });

// Register Handlers
taskManager.registerHandler(
    TaskType.SYNC_USER_PENDING_DOCS,
    createSyncUserPendingDocsHandler(forensicRepository, taskManager)
);

taskManager.registerHandler(
    TaskType.PROCESS_DOCUMENT_INTEGRITY,
    createProcessDocumentIntegrityHandler(forensicRepository, cryptoService, passkeyRepository, taskManager)
);

taskManager.registerHandler(
    TaskType.BLOCKCHAIN_PUBLISH,
    createBlockchainPublishHandler(forensicRepository, blockchainAnchor)
);

// Start Scheduler
taskManager.start().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[TaskManager] Failed to start:", message);
});


import { cors } from "@elysiajs/cors";

// Create Elysia app
const app = new Elysia()
    .use(cors({
        origin: ["http://localhost:5173", "http://localhost:5175"], // Allow both development ports
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization"],
        methods: ["GET", "POST", "OPTIONS", "PATCH", "DELETE"]
    }))
    // Mount timeline controller (already has /api prefix)
    .use(timelineController)
    .use(custodyController)
    .use(webAuthnController)
    .use(forensicController)
    .use(childController)
    // Mount better-auth handler with a more robust catch-all
    .all("/api/auth/*", async ({ request }) => {
        // Log for debugging (optional, can be removed once verified)
        console.log(`Auth request: ${request.method} ${request.url}`);
        const res = await auth.handler(request);
        console.log(`Auth response status: ${res.status}`);
        return res;
    })
    .get("/api/health", () => ({ status: "ok", timestamp: dateProvider.getIsoString() }))
    .get("/api/test", () => "test-ok")
    .post("/api/test/trigger-sync", async ({ body }) => {
        const { userId } = body as { userId: string };
        console.log(`[Test] Manually triggering Sync for User ${userId}`);
        await taskManager.schedule(TaskType.SYNC_USER_PENDING_DOCS, { userId });
        return { status: "triggered" };
    })
    .post("/api/test/process-tasks", async () => {
        console.log("[Test] Manually processing tasks...");
        // This is a bit of a hack to reach into TaskManager internals for testing
        // We call claimAndProcess a few times to flush the queue
        let processedCount = 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tm = taskManager as any;
        for (let i = 0; i < 5; i++) {
            const task = await tm.claimTask();
            if (task) {
                await tm.processTask(task);
                processedCount++;
            } else {
                break;
            }
        }
        return { status: "processed", count: processedCount };
    })
    .delete("/api/test/database", async ({ set }) => {
        if (process.env.NODE_ENV === "production") {
            set.status = 403;
            return { message: "Not allowed in production" };
        }
        console.log("[Test] Clearing Test Database...");

        // Clear MongoDB Collections
        if (mongoose.connection.db) {
            const collections = await mongoose.connection.db.collections();
            for (const collection of collections) {
                await collection.deleteMany({});
                console.log(`[Test] Cleared collection: ${collection.collectionName}`);
            }
        }

        // Clear In-Memory Repositories
        // We cast to any or the specific implementation if we know it has a clear method/property.

        // MockBlockchainAnchor: reset()
        if ((blockchainAnchor as any).reset) {
            (blockchainAnchor as any).reset();
        }

        // InMemoryTimelineRepository: clear()
        if ((timelineRepository as any).clear) {
            (timelineRepository as any).clear();
        }

        // InMemoryCustodyRepository: deleteAll()
        if ((custodyRepository as any).deleteAll) {
            await (custodyRepository as any).deleteAll();
        }

        // InMemoryScheduleRepository: clear()
        if ((scheduleRepository as any).clear) {
            (scheduleRepository as any).clear();
        }

        // InMemoryPasskeyRepository: clear()
        if ((passkeyRepository as any).clear) {
            (passkeyRepository as any).clear();
        }

        // InMemoryChildRepository: clear()
        if ((childRepository as any).clear) {
            (childRepository as any).clear();
        }

        return { status: "cleared" };
    })
    .listen({
        port: parseInt(process.env.PORT || "3000"),
        hostname: "0.0.0.0" // Ensure it's reachable
    });

console.log(`🚀 Server running at ${app.server?.hostname}:${app.server?.port}`);
console.log(`   - Auth API: /api/auth/*`);
console.log(`   - Timeline API: /api/timeline, /api/calendar/:date/timeline`);
console.log(`   - Health Check: /api/health`);
console.log(`   - Custody API: /api/custody`);
