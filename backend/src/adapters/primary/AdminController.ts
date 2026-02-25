import { Elysia, t } from "elysia";
import { RegistrationStatus } from "../../models/RegistrationProcess";
import { MongoRegistrationProcessRepository } from "../secondary/MongoRegistrationProcessRepository";
import { auth } from "../../lib/auth";
import { Family } from "../../models/Family";

export const createAdminController = (repo: MongoRegistrationProcessRepository) => {
    const rbacMiddleware = async ({ request, set }: { request: Request, set: any }) => {
        const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
        if (isDev) return;

        const session = await auth.api.getSession({
            headers: request.headers
        });

        if (!session || !session.user) {
            set.status = 401;
            return { error: "Unauthorized" };
        }

        const user = session.user as any;
        if (user.role !== "developer") {
            set.status = 403;
            return { error: "Forbidden: Developer role required" };
        }

        if (!user.webauthnCredentialId) {
            set.status = 403;
            return { error: "Forbidden: Yubico key authentication required" };
        }
    };

    const toJSON = (doc: any) => {
        const obj = doc && typeof doc.toJSON === "function" ? doc.toJSON() : doc;
        return {
            ...obj,
            _id: obj._id?.toString() || obj._id,
            familyId: obj.familyId?.toString() || obj.familyId,
            timeline: (obj.timeline || []).map((t: any) => ({
                ...t,
                timestamp: t.timestamp instanceof Date ? t.timestamp.toISOString() : (t.timestamp?.toISOString ? t.timestamp.toISOString() : t.timestamp)
            }))
        };
    };

    return new Elysia({ prefix: "/api/admin" })
        .onBeforeHandle(rbacMiddleware)
        .get("/registrations", async () => {
            const processes = await repo.findAll();
            return processes.map(toJSON);
        })
        .post("/registrations/start", async ({ body }) => {
            const { parentName, parentEmail, role } = body;

            // 1. Create family
            const family = new Family({
                parentIds: [], // Will be updated during actual registration
                children: [],
                custodyPatterns: [],
            });
            await family.save();

            // 2. Create process
            const process = await repo.save({
                familyId: family._id.toString(),
                parentAName: parentName,
                parentAEmail: parentEmail,
                status: RegistrationStatus.FLOW_STARTED,
                timeline: [{
                    type: "FLOW_STARTED",
                    message: `Rozpoczęto proces rejestracji dla ID #${family._id.toString().slice(-4)}`,
                    timestamp: new Date()
                }]
            });

            return toJSON(process);
        }, {
            body: t.Object({
                parentName: t.String(),
                parentEmail: t.String(),
                role: t.String(), // Mom/Dad
            })
        })
        .get("/registrations/:id", async ({ params, set }) => {
            const process = await repo.findById(params.id);
            if (!process) {
                set.status = 404;
                return { error: "Process not found" };
            }
            return toJSON(process);
        })
        .post("/registrations/:id/notes", async ({ params, body, set }) => {
            const process = await repo.findById(params.id);
            if (!process) {
                set.status = 404;
                return { error: "Process not found" };
            }
            process.adminNotes = body.notes;
            await repo.save(process);
            return { success: true };
        }, {
            body: t.Object({
                notes: t.String()
            })
        })
        .post("/registrations/:id/force-complete", async ({ params, set }) => {
            const process = await repo.findById(params.id);
            if (!process) {
                set.status = 404;
                return { error: "Process not found" };
            }

            process.status = RegistrationStatus.COMPLETED;
            process.timeline.push({
                type: "FORCE_COMPLETE",
                message: "Proces został wymuszony jako zakończony przez administratora",
                timestamp: new Date()
            });
            await repo.save(process);

            return { success: true };
        })
        .get("/logs", async () => {
            const allProcesses = await repo.findAll();
            const allLogs = allProcesses.flatMap(p => {
                const processObj = toJSON(p);
                return (processObj.timeline || []).map((t: any) => ({
                    ...t,
                    processId: processObj._id,
                    parentAName: processObj.parentAName
                }));
            });
            return allLogs.sort((a, b) =>
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
        });
};
