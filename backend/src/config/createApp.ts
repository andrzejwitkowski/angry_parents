import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import mongoose from "mongoose";
import { taskManager } from "../scheduler/instance";
import { t as translate } from "../lib/i18n";
import { createTimelineController } from "../adapters/rest/events/TimelineController";
import { createCustodyController } from "../adapters/rest/events/CustodyController";
import { createWebAuthnController } from "../adapters/rest/auth/WebAuthnController";
import { createAuthController } from "../adapters/rest/auth/AuthController";
import { createForensicController } from "../adapters/rest/forensic/ForensicController";
import { createChildController } from "../adapters/rest/family/ChildController";
import { createAdminController } from "../adapters/rest/auth/AdminController";
import { wireDependencies } from "./wireDependencies";
import { registerSchedulerHandlers } from "./registerSchedulerHandlers";

const enableTestEndpoints =
    process.env.NODE_ENV === "test" ||
    process.env.E2E_TEST === "true" ||
    process.env.INTEGRATION_TEST === "true" ||
    process.env.ENABLE_TEST_ENDPOINTS === "true";

export async function createApp() {
    const deps = await wireDependencies();

    const timelineController = createTimelineController(deps.timelineApiService);
    const custodyController = createCustodyController(deps.custodyApiService);
    const childController = createChildController(deps.familyApiService);
    const webAuthnController = createWebAuthnController(deps.passkeyRepository, deps.dateProvider);
    const authController = createAuthController(deps.registrationProcessRepository);
    const adminController = createAdminController(deps.registrationProcessRepository);
    const forensicController = createForensicController(deps.forensicApiService);

    registerSchedulerHandlers({
        forensicRepository: deps.forensicRepository,
        cryptoService: deps.cryptoService,
        passkeyRepository: deps.passkeyRepository,
        blockchainAnchor: deps.blockchainAnchor,
        forensicIntentRepository: deps.forensicIntentRepository,
        forensicService: deps.forensicService,
    });

    try {
        await taskManager.start();
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[TaskManager] Failed to start:", message);
        throw new Error(`TaskManager startup failed: ${message}`);
    }

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
        .get("/api/health", () => ({ status: "ok", timestamp: deps.dateProvider.getIsoString() }))
        .get("/api/assets/children.jpg", async ({ query }) => {
            const { t } = query as { t?: string };
            if (t) {
                try {
                    const { RegistrationProcess } = await import("../adapters/mongo/models/RegistrationProcessModel");
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
                                message: translate("admin.log.email_read_parent_a") as string,
                                timestamp: new Date()
                            });
                            await process.save();
                        }
                    }
                } catch (err) {
                    console.error("[Tracking] Failed to log email opened event:", err);
                }
            }
            return Bun.file("backend/src/assets/children.jpg");
        })
        ;

    if (enableTestEndpoints) {
        finalApp
            .get("/api/test", () => "test-ok")
            .post("/api/test/trigger-sync", async ({ body }: { body: any }) => {
                const { userId } = body as { userId: string };
                await taskManager.schedule("SYNC_USER_PENDING_DOCS" as any, { userId });
                return { status: "triggered" };
            })
            .post("/api/test/process-tasks", async () => {
                let processedCount = 0;
                const tm = taskManager as any;
                if (tm.claimAndProcess) {
                    await tm.claimAndProcess();
                    processedCount++;
                }
                return { status: "processed", count: processedCount };
            })
            .delete("/api/test/database", async () => {
                if (mongoose.connection.db) {
                    const collections = await mongoose.connection.db.listCollections().toArray();
                    for (const col of collections) {
                        await mongoose.connection.db.collection(col.name).deleteMany({});
                    }
                }

                if ((deps.timelineRepository as any).clear) (deps.timelineRepository as any).clear();
                if ((deps.custodyRepository as any).deleteAll) (deps.custodyRepository as any).deleteAll();
                if ((deps.passkeyRepository as any).clear) (deps.passkeyRepository as any).clear();
                if ((deps.blockchainAnchor as any).reset) (deps.blockchainAnchor as any).reset();

                return { status: "cleared" };
            })
            .get("/api/test/routes", () => {
                return finalApp.routes;
            });
    }

    (globalThis as any).app = finalApp;

    return { app: finalApp, deps };
}
