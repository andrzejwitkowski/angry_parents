import { Elysia, t as T } from "elysia";
import { RegistrationStatus, ParentRegistrationStatus } from "../../mongo/models/RegistrationProcessModel";
import { MongoRegistrationProcessRepository } from "../../mongo/repositories/auth/MongoRegistrationProcessRepository";
import { auth } from "../../../lib/auth";
import { Family } from "../../mongo/models/FamilyModel";
import { Invitation } from "../../mongo/models/InvitationModel";
import { sendParentAInitiationEmail } from "../../../lib/email";
import crypto from "crypto";
import { t as translate } from "../../../lib/i18n";

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
        const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";

        return {
            ...obj,
            _id: obj._id?.toString() || obj._id,
            familyId: obj.familyId?.toString() || obj.familyId,
            dadToken: isDev ? obj.dadToken : undefined,
            momToken: isDev ? obj.momToken : undefined,
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
            const { familyName, dadEmail, momEmail } = body;

            // 1. Create family
            const family = new Family({
                name: familyName || (translate("common.familyDefault") as string),
                parentIds: [], // Will be updated during actual registration
                children: [],
                custodyPatterns: [],
            });
            await family.save();

            // 2. Generate tokens and invitation
            const dadToken = crypto.randomBytes(32).toString("hex");
            const momToken = crypto.randomBytes(32).toString("hex");
            const dadTrackingToken = crypto.randomUUID();
            const momTrackingToken = crypto.randomUUID();

            const dadInvitation = new Invitation({
                token: dadToken,
                email: dadEmail,
                familyId: family._id.toString(),
                targetRole: "dad",
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
                status: "pending"
            });

            const momInvitation = new Invitation({
                token: momToken,
                email: momEmail,
                familyId: family._id.toString(),
                targetRole: "mom",
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
                status: "pending"
            });

            await Promise.all([dadInvitation.save(), momInvitation.save()]);

            // 3. Send email (async)
            const [dadEmailResponse, momEmailResponse] = await Promise.all([
                sendParentAInitiationEmail(dadEmail, dadToken, familyName || (translate("common.familyDefault") as string), "pl", dadTrackingToken),
                sendParentAInitiationEmail(momEmail, momToken, familyName || (translate("common.familyDefault") as string), "pl", momTrackingToken)
            ]);

            // 4. Create process record
            const regProcess = await repo.save({
                familyId: family._id.toString(),
                familyName: familyName || (translate("common.familyDefault") as string),
                dadToken,
                momToken,
                dadTrackingToken,
                momTrackingToken,
                dadEmail,
                momEmail,
                dadStatus: ParentRegistrationStatus.INVITATION_SENT,
                momStatus: ParentRegistrationStatus.INVITATION_SENT,
                status: RegistrationStatus.FLOW_STARTED,
                timeline: [{
                    type: "FLOW_STARTED",
                    message: translate("admin.log.flow_started_with_family", {
                        familyName: familyName || (translate("common.familyDefault") as string),
                        id: family._id.toString().slice(-4)
                    }) as string,
                    timestamp: new Date()
                }]
            });

            const result = toJSON(regProcess);
            const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
            if (isDev) {
                result.dadPreviewHtml = dadEmailResponse.html;
                result.momPreviewHtml = momEmailResponse.html;
            }
            return result;
        }, {
            body: T.Object({
                dadEmail: T.String(),
                momEmail: T.String(),
                familyName: T.Optional(T.String()),
            })
        })
        .get("/registrations/:id", async ({ params, set }) => {
            const regProcess = await repo.findById(params.id);
            if (!regProcess) {
                set.status = 404;
                return { error: "Process not found" };
            }

            const result = toJSON(regProcess) as any;
            const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";

            if (isDev && regProcess.familyId) {
                // If in dev, try to expose tokens from invitations just in case
                const dadInv = await Invitation.findOne({
                    familyId: regProcess.familyId,
                    targetRole: "dad"
                });
                const momInv = await Invitation.findOne({
                    familyId: regProcess.familyId,
                    targetRole: "mom"
                });
                if (dadInv) result.dadToken = dadInv.token;
                if (momInv) result.momToken = momInv.token;
            }

            return result;
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
            body: T.Object({
                notes: T.String()
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
                message: translate("admin.log.force_completed_by_admin") as string,
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
                }));
            });
            return allLogs.sort((a, b) =>
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
        });
};
