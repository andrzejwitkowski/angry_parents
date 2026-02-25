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
import { createAuthController } from "./adapters/primary/AuthController";

const passkeyRepository = new InMemoryPasskeyRepository();
const webAuthnController = createWebAuthnController(passkeyRepository, dateProvider);
const authController = createAuthController();

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
const app = new Elysia();
(globalThis as any).app = app;

const finalApp = app
    .use(cors({
        origin: ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"], // Allow development ports
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
        methods: ["GET", "POST", "OPTIONS", "PATCH", "DELETE"]
    }))
    .use(timelineController)
    .use(custodyController)
    .use(webAuthnController)
    .group("/api/auth", app => app.use(authController))
    .use(forensicController)
    .use(childController)
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
        let processedCount = 0;
        const tm = taskManager as any;
        if (tm.claimAndProcess) {
            await tm.claimAndProcess();
            processedCount++;
        }
        return { status: "processed", count: processedCount };
    })
    .delete("/api/test/database", async ({ set }) => {
        const isDev = process.env.NODE_ENV !== "production";
        if (!isDev) {
            set.status = 403;
            return { error: "Only available in dev mode" };
        }

        console.log("[Test] Resetting database...");
        if (mongoose.connection.db) {
            const collections = await mongoose.connection.db.listCollections().toArray();
            for (const col of collections) {
                await mongoose.connection.db.collection(col.name).deleteMany({});
                console.log(`[Test] Cleared collection: ${col.name}`);
            }
        }

        if ((passkeyRepository as any).clear) {
            (passkeyRepository as any).clear();
            console.log("[PasskeyRepo] Cleared.");
        }

        if ((blockchainAnchor as any).reset) {
            (blockchainAnchor as any).reset();
            console.log("[MockBlockchain] Reset.");
        }

        return { status: "cleared" };
    })
    .get("/api/test/routes", ({ store }: { store: any }) => {
        return (globalThis as any).app?.routes;
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
