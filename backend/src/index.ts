import { Elysia } from "elysia";
import mongoose from "mongoose";
import { taskManager } from "./scheduler/instance";
import { TaskType } from "./scheduler/types";
import { createSyncUserPendingDocsHandler } from "./scheduler/handlers/SyncUserPendingDocs";
import { createProcessDocumentIntegrityHandler } from "./scheduler/handlers/ProcessDocumentIntegrity";
import { createBlockchainPublishHandler } from "./scheduler/handlers/BlockchainPublish";
import { createProcessForensicIntentHandler } from "./scheduler/handlers/ProcessForensicIntent";
import { MongoForensicRepository } from "./adapters/secondary/MongoForensicRepository";
import { BunCryptoService } from "./adapters/secondary/BunCryptoService";
import { ViemBlockchainAnchor } from "./adapters/secondary/ViemBlockchainAnchor";
import { auth } from "./lib/auth";
import { ForensicService } from "./application/ForensicService";
import { forensicController as createForensicController } from "./adapters/primary/ForensicController";
import { MongoTimelineRepository } from "./adapters/secondary/MongoTimelineRepository";
import { TimelineServiceImpl } from "./application/TimelineService";
import { Family } from "./models/Family";
import { t as translate } from "./lib/i18n";
import { createTimelineController } from "./adapters/primary/TimelineController";
import { RealDateProvider } from "./adapters/secondary/RealDateProvider";
import { RealUuidProvider } from "./adapters/secondary/RealUuidProvider";
import { MongoRegistrationProcessRepository } from "./adapters/secondary/MongoRegistrationProcessRepository";
import { createAdminController } from "./adapters/primary/AdminController";
import { MongoCustodyRepository } from "./adapters/secondary/MongoCustodyRepository";
import { createCustodyController } from "./adapters/primary/CustodyController";
import { MongoScheduleRepository } from "./adapters/secondary/MongoScheduleRepository";
import { ScheduleService } from "./application/ScheduleService";
import { PropagationService } from "./application/PropagationService";
import { MongoChildRepository } from "./adapters/secondary/MongoChildRepository";
import { ChildService } from "./application/ChildService";
import { createChildController } from "./adapters/primary/ChildController";
import { MongoPasskeyRepository } from "./adapters/secondary/MongoPasskeyRepository";
import { MongoForensicIntentRepository } from "./adapters/secondary/MongoForensicIntentRepository";
import { createWebAuthnController } from "./adapters/primary/WebAuthnController";
import { createAuthController } from "./adapters/primary/AuthController";
import { cors } from "@elysiajs/cors";
import { MockBlockchainAnchor } from "./adapters/secondary/MockBlockchainAnchor";

const dateProvider = new RealDateProvider();
const uuidProvider = new RealUuidProvider();

// --- MongoDB & Repositories Setup ---
try {
    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/angry_parents";
    await mongoose.connect(mongoUri);
    console.log("[MongoDB] Connected");
} catch (e) {
    console.warn("[MongoDB] Connection failed, Task Scheduler may not function:", e);
}

if (!mongoose.connection.db) {
    throw new Error("MongoDB connection not established");
}

// Repositories
const registrationProcessRepository = new MongoRegistrationProcessRepository(mongoose.connection.db as any);
const forensicRepository = new MongoForensicRepository(mongoose.connection.db as any);
const timelineRepository = new MongoTimelineRepository();
const forensicIntentRepository = new MongoForensicIntentRepository();
const custodyRepository = new MongoCustodyRepository();
const scheduleRepository = new MongoScheduleRepository();
const childRepository = new MongoChildRepository();
const passkeyRepository = new MongoPasskeyRepository();

// Services
// Services
const cryptoService = new BunCryptoService();
const blockchainAnchor = new MockBlockchainAnchor();
const forensicService = new ForensicService(forensicRepository, blockchainAnchor, cryptoService, taskManager);

const timelineService = new TimelineServiceImpl(
    timelineRepository,
    dateProvider,
    uuidProvider,
    cryptoService,
    Family,
    childRepository,
    forensicIntentRepository,
    taskManager
);
const scheduleService = new ScheduleService(scheduleRepository, custodyRepository, dateProvider, uuidProvider);
const propagationService = new PropagationService(scheduleRepository);
const childService = new ChildService(childRepository, timelineRepository, uuidProvider);

// Controllers
const timelineController = createTimelineController(timelineService);
const custodyController = createCustodyController(custodyRepository, scheduleService, propagationService, uuidProvider);
const childController = createChildController(childService);
const webAuthnController = createWebAuthnController(passkeyRepository, dateProvider);
const authController = createAuthController(registrationProcessRepository);
const adminController = createAdminController(registrationProcessRepository);
const forensicController = createForensicController({ forensicService, forensicRepository });

// Task Scheduler Configuration
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

taskManager.registerHandler(
    TaskType.PROCESS_FORENSIC_INTENT,
    createProcessForensicIntentHandler(forensicIntentRepository, forensicService)
);

// Start Scheduler
taskManager.start().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[TaskManager] Failed to start:", message);
});

// Create Elysia app
const app = new Elysia();

const finalApp = app
    .use(cors({
        origin: (request) => {
            const origin = request.headers.get("origin");
            if (!origin) return false;

            const isLocalhost = origin.startsWith("http://localhost:") || origin === "http://localhost";
            const allowedStaticOrigins = ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"];

            if (isLocalhost || allowedStaticOrigins.includes(origin)) {
                return true;
            }
            return false;
        },
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
    .use(adminController)
    .get("/api/health", () => ({ status: "ok", timestamp: dateProvider.getIsoString() }))
    .get("/api/assets/children.jpg", async ({ query }) => {
        const { t } = query as { t?: string };
        if (t) {
            try {
                const { RegistrationProcess, RegistrationStatus } = await import("./models/RegistrationProcess");
                const process = await RegistrationProcess.findOne({
                    $or: [
                        { dadTrackingToken: t },
                        { momTrackingToken: t }
                    ]
                });

                if (process) {
                    const isDad = process.dadTrackingToken === t;
                    const openedAtField = isDad ? "dadOpenedAt" : "momOpenedAt";

                    if (!(process as any)[openedAtField]) {
                        (process as any)[openedAtField] = new Date();
                        if (isDad) {
                            process.dadStatus = "EMAIL_OPENED";
                        } else {
                            process.momStatus = "EMAIL_OPENED";
                        }
                        process.timeline.push({
                            type: "EMAIL_READ",
                            familyName: process.familyName || (translate("common.familyDefault") as string),
                            message: translate("admin.log.email_read_parent_a") as string, // keeping same translation key for now
                            timestamp: new Date()
                        });
                        await process.save();
                        console.log(`[Tracking] Email opened event logged for ${isDad ? "Dad" : "Mom"} (Token: ${t})`);
                    }
                }
            } catch (err) {
                console.error("[Tracking] Failed to log email opened event:", err);
            }
        }
        return Bun.file("backend/src/assets/children.jpg");
    })
    .get("/api/test", () => "test-ok")
    .post("/api/test/trigger-sync", async ({ body }: { body: any }) => {
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

        // For Dev testing only: Try to clear all local repository state if method exists
        if ((timelineRepository as any).clear) {
            (timelineRepository as any).clear();
        }
        if ((custodyRepository as any).deleteAll) {
            (custodyRepository as any).deleteAll();
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
    .get("/api/test/routes", () => {
        return (globalThis as any).app?.routes;
    })
    .listen({
        port: parseInt(process.env.PORT || "3000"),
        hostname: "0.0.0.0"
    });

(globalThis as any).app = finalApp;

console.log(`🚀 Server running at ${app.server?.hostname}:${app.server?.port}`);
console.log(`   - Auth API: /api/auth/*`);
console.log(`   - Timeline API: /api/timeline, /api/calendar/:date/timeline`);
console.log(`   - Health Check: /api/health`);
console.log(`   - Custody API: /api/custody`);
