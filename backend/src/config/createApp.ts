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
import { formatErrorResponse, mapErrorToStatus } from "../adapters/rest/common/errorMapper";
import { DEFAULT_DEV_DAD_ID, DEFAULT_DEV_MOM_ID, ensureMockFamily, getDevKeyPair } from "../adapters/rest/auth/devMockFamily";
import { wireDependencies } from "./wireDependencies";
import { registerSchedulerHandlers } from "./registerSchedulerHandlers";
import { TaskType } from "../domain/shared/ports/TaskScheduler";

export async function createApp() {
    const enableTestEndpoints =
        process.env.NODE_ENV === "test" ||
        process.env.E2E_TEST === "true" ||
        process.env.INTEGRATION_TEST === "true" ||
        process.env.ENABLE_TEST_ENDPOINTS === "true";
    const enableProofPublishTestEndpoint =
        process.env.NODE_ENV === "test" ||
        process.env.E2E_TEST === "true";

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
        timelineEventProofService: deps.timelineEventProofService,
        eventProofReconciliationService: deps.eventProofReconciliationService,
    });

    try {
        await taskManager.start();
        await deps.taskOutboxDispatcher.dispatchNext().catch((error: unknown) => {
            console.error("[TaskOutboxDispatcher] Initial dispatch failed:", error instanceof Error ? error.message : String(error));
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[TaskManager] Failed to start:", message);
        throw new Error(`TaskManager startup failed: ${message}`);
    }

    let outboxDispatchInFlight = false;
    const outboxDispatchLoop = setInterval(async () => {
        if (outboxDispatchInFlight) {
            return;
        }

        outboxDispatchInFlight = true;
        try {
            while (await deps.taskOutboxDispatcher.dispatchNext()) {
                // Drain available outbox work before yielding.
            }
        } catch (error) {
            console.error("[TaskOutboxDispatcher] Background dispatch failed:", error instanceof Error ? error.message : String(error));
        } finally {
            outboxDispatchInFlight = false;
        }
    }, 200);
    outboxDispatchLoop.unref?.();

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
                                message: translate(
                                    isDad ? "admin.log.email_read_parent_a" : "admin.log.email_read_parent_b"
                                ) as string,
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
                await taskManager.schedule(TaskType.SYNC_USER_PENDING_DOCS, { userId });
                return { status: "triggered" };
            })
            .post("/api/test/process-tasks", async () => {
                let processedCount = 0;
                const tm = taskManager as any;
                if (typeof tm.claimTask === "function" && typeof tm.processTask === "function") {
                    const task = await tm.claimTask();
                    if (task) {
                        await tm.processTask(task);
                        processedCount++;
                    }
                } else if (tm.claimAndProcess) {
                    await tm.claimAndProcess();
                    processedCount++;
                }
                return { status: "processed", count: processedCount };
            })
            .post("/api/test/process-outbox", async () => {
                const dispatched = await deps.taskOutboxDispatcher.dispatchNext().catch(() => false);
                return { status: "processed", dispatched };
            })
            .post("/api/test/outbox/disable", async () => {
                (deps.taskOutboxDispatcher as any).setDisabled?.(true);
                return { status: "disabled" };
            })
            .post("/api/test/outbox/enable", async () => {
                (deps.taskOutboxDispatcher as any).setDisabled?.(false);
                return { status: "enabled" };
            })
            .post("/api/test/events/delay-receipt", async ({ body, set }) => {
                const blockchainAnchor = deps.blockchainAnchor as any;
                if (typeof blockchainAnchor.delayNextReceipt !== "function") {
                    set.status = 400;
                    return { error: "receipt delay hook unavailable" };
                }

                blockchainAnchor.delayNextReceipt();
                return { status: "delayed" };
            })
            .get("/api/test/events/blockchain-stats", ({ set }) => {
                const blockchainAnchor = deps.blockchainAnchor as any;
                if (typeof blockchainAnchor.getSubmitCount !== "function") {
                    set.status = 400;
                    return { error: "blockchain stats unavailable" };
                }

                return {
                    submitCount: blockchainAnchor.getSubmitCount()
                };
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
            .post("/api/test/dev/seed-mock-family", async () => {
                const devKeyPair = await getDevKeyPair();
                const family = await ensureMockFamily({
                    dadUserId: DEFAULT_DEV_DAD_ID,
                    momUserId: DEFAULT_DEV_MOM_ID,
                    devPublicKey: devKeyPair.publicKey
                });

                return {
                    status: "seeded",
                    familyId: family._id.toString(),
                    parentIds: family.parentIds,
                    childrenCount: family.children.length
                };
            })
            .post("/api/test/dev/seed-mock-family-demo", async () => {
                const devKeyPair = await getDevKeyPair();
                const family = await ensureMockFamily({
                    dadUserId: DEFAULT_DEV_DAD_ID,
                    momUserId: DEFAULT_DEV_MOM_ID,
                    devPublicKey: devKeyPair.publicKey,
                    includeDemoChild: true
                });

                return {
                    status: "seeded",
                    familyId: family._id.toString(),
                    parentIds: family.parentIds,
                    childrenCount: family.children.length
                };
            })
            .get("/api/test/routes", () => {
                return finalApp.routes;
            });

        if (enableProofPublishTestEndpoint) {
            finalApp.post("/api/test/events/publish-proof", async ({ body, set }) => {
                try {
                    const { id } = body as { id?: string };
                    if (!id) {
                        set.status = 400;
                        return { error: "id is required" };
                    }

                    return await deps.timelineEventProofService.publishProof(id);
                } catch (error) {
                    set.status = (error as any)?.status ?? mapErrorToStatus(error);
                    return { error: formatErrorResponse(error) };
                }
            });
        }
    }

    (globalThis as any).app = finalApp;

    return { app: finalApp, deps };
}
