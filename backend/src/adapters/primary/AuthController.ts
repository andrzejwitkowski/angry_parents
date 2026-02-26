import { Elysia, t } from "elysia";
import { auth } from "../../lib/auth";
import { Family } from "../../models/Family";
import { Invitation, type Gender } from "../../models/Invitation";
import { RegistrationStatus, ParentRegistrationStatus } from "../../models/RegistrationProcess";
import { MongoRegistrationProcessRepository } from "../secondary/MongoRegistrationProcessRepository";
import { signJwt, verifyJwt } from "../../lib/jwt";
import { sendInvitationEmail } from "../../lib/email";
import {
    generateRegistrationOptions,
    generateAuthenticationOptions,
    verifyRegistrationResponse,
    verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { t as translate } from "../../lib/i18n";
import { isoUint8Array, isoBase64URL } from "@simplewebauthn/server/helpers";
import mongoose from "mongoose";

const rpName = "Angry Parents Co-Parenting";
const rpID = "localhost";
const origin = ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"];

const registrationChallenges = new Map<string, string>();

function setCookie(token: string): string {
    const isProd = process.env.NODE_ENV === "production";
    const secure = isProd ? "; Secure" : "";
    const sameSite = isProd ? "Strict" : "Lax";
    return `token=${token}; HttpOnly${secure}; SameSite=${sameSite}; Path=/; Max-Age=604800`;
}

function getJwtFromCookie(request: Request): string | null {
    const cookie = request.headers.get("Cookie");
    if (!cookie) return null;
    const match = cookie.match(/token=([^;]+)/);
    return match ? match[1] : null;
}

async function createBetterAuthUser(email: string, name: string, username: string, gender?: Gender, familyId?: string, webauthnCredentialId?: string) {
    const password = "webauthn-" + Date.now();

    const signupResult = await auth.api.signUpEmail({
        headers: new Headers({ "Content-Type": "application/json" }),
        body: { email, password, name, username },
    });

    if (!signupResult || !("user" in signupResult) || !signupResult.user) {
        throw new Error("Failed to create user");
    }

    const userId = signupResult.user.id;

    const updateData: Record<string, unknown> = {};
    if (gender) updateData.gender = gender;
    if (familyId) updateData.familyId = familyId;
    if (webauthnCredentialId) updateData.webauthnCredentialId = webauthnCredentialId;

    if (Object.keys(updateData).length > 0) {
        // @ts-ignore - BetterAuth type mismatch in some versions
        await auth.api.updateUser({
            headers: new Headers({ "Content-Type": "application/json" }),
            body: { userId, ...(updateData as any) },
        }).catch(() => { });
    }

    return { userId, email: signupResult.user.email, name: signupResult.user.name };
}

export const createAuthController = (registrationRepo: MongoRegistrationProcessRepository) => {
    return new Elysia()
        .post("/register/options", async ({ body, set }) => {
            console.log("[Register] options hit");
            const { email, name, username, gender } = body as {
                email: string;
                name: string;
                username: string;
                gender: Gender;
            };

            if (!email || !name || !username || !gender) {
                set.status = 400;
                return { message: "Missing required fields" };
            }

            if (gender !== "mom" && gender !== "dad") {
                set.status = 400;
                return { message: "Invalid gender" };
            }

            const options = await generateRegistrationOptions({
                rpName,
                rpID,
                userID: isoUint8Array.fromUTF8String(email),
                userName: email,
                attestationType: 'none',
                authenticatorSelection: {
                    userVerification: 'preferred',
                    residentKey: 'preferred',
                },
            });

            registrationChallenges.set(email, options.challenge);

            set.headers["Content-Type"] = "application/json";
            return {
                ...options,
                tempEmail: email,
                tempName: name,
                tempUsername: username,
                tempGender: gender,
            };
        }, {
            body: t.Object({
                email: t.String(),
                name: t.String(),
                username: t.String(),
                gender: t.Union([t.Literal("mom"), t.Literal("dad")]),
            }),
        })
        .get("/register/invitation", async ({ query, set }) => {
            console.log("[Register] GET invitation hit");
            const token = query.token;
            if (!token) {
                set.status = 400;
                return { message: "Missing token" };
            }

            const invitation = await Invitation.findOne({ token, status: "pending" });
            if (!invitation) {
                set.status = 404;
                return { message: "Invitation not found or expired" };
            }

            return {
                email: invitation.email,
                gender: invitation.targetRole, // "dad" or "mom"
            };
        }, {
            query: t.Object({
                token: t.String()
            })
        })
        .post("/register/verify", async ({ body, set }) => {
            console.log("[Register] verify hit", JSON.stringify(body));
            try {
                const { registrationResponse, tempEmail, tempName, tempUsername, tempGender, mock, token } = body as {
                    registrationResponse?: unknown;
                    tempEmail?: string;
                    tempName?: string;
                    tempUsername?: string;
                    tempGender?: Gender;
                    mock?: boolean;
                    token?: string;
                };

                const isMock = !!mock;
                const isDev = process.env.NODE_ENV !== "production";

                let userId: string;
                let credentialId = "mock-credential";
                let familyIdToUse: string | undefined;

                // If token is provided, this is an Admin-initiated flow
                let invitationRole: "dad" | "mom" | undefined;
                if (token) {
                    const invitation = await Invitation.findOne({ token, status: "pending", targetRole: { $in: ["dad", "mom"] } });
                    if (!invitation) {
                        set.status = 400;
                        return { message: "Invalid or expired invitation token" };
                    }
                    familyIdToUse = invitation.familyId.toString();
                    invitationRole = invitation.targetRole as "dad" | "mom";
                    console.log(`[Register] Token valid. Joining family: ${familyIdToUse} as ${invitationRole}`);

                    // Mark invitation as accepted
                    invitation.status = "accepted";
                    await invitation.save();
                }

                if (isDev && isMock) {
                    userId = new mongoose.Types.ObjectId().toString();
                    console.log("[ParentA] Mock mode, generated userId:", userId);
                } else {
                    console.log("[ParentA] WebAuthn mode for", tempEmail);
                    const emailToVerify = tempEmail || (token ? (await Invitation.findOne({ token }))?.email : undefined);

                    if (!emailToVerify) {
                        set.status = 400;
                        return { message: "Missing email for verification" };
                    }
                    const expectedChallenge = registrationChallenges.get(emailToVerify);
                    if (!expectedChallenge) {
                        console.error("[ParentA] Challenge not found or expired for", emailToVerify);
                        set.status = 400;
                        return { message: "Challenge not found or expired" };
                    }
                    try {
                        console.log("[ParentA] Verifying registration response...");
                        const verification = await verifyRegistrationResponse({
                            // @ts-expect-error - WebAuthn types
                            response: registrationResponse,
                            expectedChallenge,
                            expectedOrigin: origin,
                            expectedRPID: rpID,
                        });

                        if (!verification.verified || !verification.registrationInfo) {
                            console.error("[ParentA] Verification failed:", verification);
                            set.status = 400;
                            return { message: "Verification failed" };
                        }
                        console.log("[ParentA] Registration response verified successfully.");

                        const info = verification.registrationInfo!;
                        credentialId = typeof info.credential.id === 'string'
                            ? info.credential.id
                            : isoBase64URL.fromBuffer(info.credential.id);
                        userId = new mongoose.Types.ObjectId().toString(); // Generate a new ObjectId for the user
                        console.log(`[ParentA] Generated userId: ${userId}, credentialId: ${credentialId}`);
                    } catch (e) {
                        console.error("[ParentA] Verification error", e);
                        set.status = 400;
                        return { message: e instanceof Error ? e.message : "Verification failed" };
                    }
                }

                let family;
                if (familyIdToUse) {
                    family = await Family.findById(familyIdToUse);
                    if (family) {
                        if (!family.parentIds.includes(userId)) {
                            family.parentIds.push(userId);
                            await family.save();
                        }
                    } else {
                        throw new Error("Family not found");
                    }
                } else {
                    console.log(`[ParentA] Creating family for userId: ${userId}`);
                    family = new Family({
                        parentIds: [userId],
                        children: [],
                        custodyPatterns: [],
                    });
                    await family.save();
                    console.log(`[ParentA] Family created: ${family._id}`);
                }

                const finalEmail = tempEmail || (token ? (await Invitation.findOne({ token, status: "accepted" }))?.email : "unknown@example.com");

                const baUser = await createBetterAuthUser(
                    finalEmail!,
                    tempName || "Parent A",
                    tempUsername || finalEmail!.split("@")[0],
                    tempGender,
                    family._id.toString(),
                    credentialId
                );
                console.log(`[ParentA] BetterAuth user created for ${finalEmail}, userId: ${baUser.userId}`);

                if (!isMock && finalEmail) {
                    registrationChallenges.delete(finalEmail);
                    console.log(`[ParentA] Deleted challenge for ${finalEmail}`);
                }

                // Update Registration Process
                const regProcess = await registrationRepo.findByFamilyId(family._id.toString());
                const roleUsed = invitationRole || tempGender || "dad";

                if (regProcess) {
                    if (roleUsed === "dad") {
                        regProcess.dadStatus = ParentRegistrationStatus.REGISTERED;
                        regProcess.dadRegisteredAt = new Date();
                        if (!regProcess.dadName) regProcess.dadName = tempName;
                    } else {
                        regProcess.momStatus = ParentRegistrationStatus.REGISTERED;
                        regProcess.momRegisteredAt = new Date();
                        if (!regProcess.momName) regProcess.momName = tempName;
                    }

                    if (regProcess.dadStatus === ParentRegistrationStatus.REGISTERED && regProcess.momStatus === ParentRegistrationStatus.REGISTERED) {
                        regProcess.status = RegistrationStatus.COMPLETED;
                        regProcess.timeline.push({
                            type: RegistrationStatus.COMPLETED,
                            message: translate("admin.log.force_completed_by_admin") as string, // Might need better translation key
                            timestamp: new Date()
                        });
                    }

                    regProcess.timeline.push({
                        type: "PARENT_REGISTERED",
                        message: translate("admin.log.parent_a_registered", { email: finalEmail }) as string, // Reusing existing translate
                        timestamp: new Date()
                    });
                    await registrationRepo.save(regProcess);
                }

                const tokenValue = await signJwt({
                    userId: baUser.userId,
                    familyId: family._id.toString(),
                    role: roleUsed,
                    gender: roleUsed,
                });
                console.log("[Register] JWT signed.");

                set.headers["Set-Cookie"] = setCookie(tokenValue);
                set.headers["Content-Type"] = "application/json";
                console.log("[Register] verify success");
                return { verified: true, role: roleUsed };
            } catch (err) {
                console.error("[ParentA] verify error:", err);
                set.status = 500;
                return { message: err instanceof Error ? err.message : "Internal error" };
            }
        }, {
            body: t.Any(),
        })

        .post("/invite", async ({ request, body, set }) => {
            console.log("[Invite] hit");
            const token = getJwtFromCookie(request);
            if (!token) {
                set.status = 401;
                return { message: "Unauthorized" };
            }

            const payload = await verifyJwt(token);
            if (!payload || !payload.userId) {
                set.status = 401;
                return { message: "Invalid token" };
            }
            console.log(`[Invite] User ${payload.userId} is inviting.`);

            const { email } = body as { email: string };
            if (!email) {
                set.status = 400;
                return { message: "Email is required" };
            }

            if (!payload.familyId) {
                set.status = 400;
                return { message: "User has no family" };
            }

            const inviterGender = payload.gender;
            if (!inviterGender) {
                set.status = 400;
                return { message: "Inviter has no gender set" };
            }

            const existingInvitation = await Invitation.findOne({
                email,
                familyId: payload.familyId,
                status: "pending",
                expiresAt: { $gt: new Date() },
            });

            if (existingInvitation) {
                set.status = 400;
                return { message: "Invitation already sent to this email" };
            }

            const cryptoModule = await import("crypto");
            const inviteToken = cryptoModule.randomUUID();
            const parentBTrackingToken = cryptoModule.randomUUID();
            console.log(`[Invite] Generated invite token: ${inviteToken}, tracking: ${parentBTrackingToken} for ${email}`);

            const targetRole = inviterGender === "dad" ? "mom" : "dad";

            const invitation = new Invitation({
                token: inviteToken,
                email,
                familyId: payload.familyId,
                invitedBy: payload.userId,
                createdByGender: inviterGender,
                targetRole,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                status: "pending",
            });
            await invitation.save();
            console.log(`[Invite] Invitation saved for ${email}`);

            // Fetch family name for email
            const family = await Family.findById(payload.familyId);
            const familyName = family?.name || "Rodzina";

            const { html } = await sendInvitationEmail(email, inviteToken, familyName, "pl", parentBTrackingToken);
            console.log(`[Invite] Invitation email sent to ${email}`);

            // Update Registration Process
            const regProcess = await registrationRepo.findByFamilyId(payload.familyId);
            if (regProcess) {
                if (targetRole === "dad") {
                    regProcess.dadStatus = ParentRegistrationStatus.INVITATION_SENT;
                    regProcess.dadEmail = email;
                    regProcess.dadTrackingToken = parentBTrackingToken;
                } else {
                    regProcess.momStatus = ParentRegistrationStatus.INVITATION_SENT;
                    regProcess.momEmail = email;
                    regProcess.momTrackingToken = parentBTrackingToken;
                }

                regProcess.timeline.push({
                    type: "INVITATION_SENT" as any, // Timeline still accepts this string usually
                    message: translate("admin.log.invitation_sent", { email: email }) as string,
                    timestamp: new Date()
                });
                await registrationRepo.save(regProcess);
            }

            set.headers["Content-Type"] = "application/json";
            const response: any = { token: inviteToken, link: `${process.env.FRONTEND_URL || "http://localhost:5173"}/register?token=${inviteToken}` };
            const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
            if (isDev) {
                response.previewHtml = html;
            }
            return response;
        }, {
            body: t.Object({
                email: t.String(),
            }),
        })

        .post("/login/options", async ({ set }) => {
            console.log("[Login] options hit");
            const options = await generateAuthenticationOptions({
                rpID,
                userVerification: 'preferred',
            });
            console.log("[Login] Generated authentication options.");

            set.headers["Content-Type"] = "application/json";
            return options;
        })
        .post("/login/verify", async ({ body, set }) => {
            console.log("[Login] verify hit", JSON.stringify(body));
            const { authenticationResponse, mockLogin, userId } = body as {
                authenticationResponse?: unknown;
                mockLogin?: boolean;
                userId?: string;
            };

            const isDev = process.env.NODE_ENV !== "production";

            if (isDev && mockLogin) {
                const finalUserId = userId || new mongoose.Types.ObjectId().toString();
                const finalFamilyId = new mongoose.Types.ObjectId().toString();
                console.log(`[Login] Mock login for userId: ${finalUserId}`);
                const token = await signJwt({
                    userId: finalUserId,
                    familyId: finalFamilyId,
                    role: "dad",
                    gender: "dad",
                });
                console.log("[Login] Mock JWT signed.");

                set.headers["Set-Cookie"] = setCookie(token);
                set.headers["Content-Type"] = "application/json";
                return { verified: true };
            }

            set.status = 400;
            return { message: "Real WebAuthn login not fully implemented yet" };
        }, {
            body: t.Any(),
        })
        .get("/me", async ({ request, set }) => {
            console.log("[Me] hit");
            try {
                const token = getJwtFromCookie(request);
                if (!token) {
                    set.status = 401;
                    return { message: "Unauthorized" };
                }

                const payload = await verifyJwt(token);
                if (!payload || !payload.userId) {
                    set.status = 401;
                    return { message: "Invalid token" };
                }
                console.log(`[Me] User ${payload.userId} requested info.`);

                let family = null;
                if (payload.familyId && mongoose.Types.ObjectId.isValid(payload.familyId)) {
                    family = await Family.findById(payload.familyId).lean();
                    console.log(`[Me] Found family ${payload.familyId}`);
                }

                set.headers["Content-Type"] = "application/json";
                return {
                    user: {
                        id: payload.userId,
                        email: payload.userId + "@example.com",
                        name: "User",
                        gender: payload.gender,
                        familyId: payload.familyId,
                        family: family
                    }
                };
            } catch (err) {
                console.error("[Me] error:", err);
                set.status = 500;
                return { message: "Internal server error" };
            }
        })
        .post("/logout", async ({ set }) => {
            console.log("[Logout] hit");
            set.headers["Set-Cookie"] = "token=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0";
            set.headers["Content-Type"] = "application/json";
            return { ok: true };
        })
        .post("/mock-register", async ({ body, set }) => {
            console.log("[MockReg] hit", body);
            const { email, name, gender, token } = body as { email: string, name: string, gender: Gender, token?: string };

            const res = await (globalThis as any).app.handle(new Request("http://localhost/api/auth/register/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tempEmail: email,
                    tempName: name,
                    tempGender: gender,
                    mock: true,
                    token
                })
            }));

            const json = await res.json();
            if (res.status !== 200) {
                set.status = res.status;
                return json;
            }

            set.headers["Set-Cookie"] = res.headers.get("Set-Cookie");
            return json;
        })
        .post("/mock-login", async ({ body, set }) => {
            const isDev = process.env.NODE_ENV !== "production";
            if (!isDev) {
                set.status = 403;
                return { message: "Dev endpoint only" };
            }

            const mockBody = {
                mockLogin: true,
                userId: (body as { userId?: string }).userId,
            };

            // Use dynamic port so this works under any test runner (port 3000 locally, 3002 in npm run test)
            const selfPort = process.env.PORT || "3000";
            const res = await fetch(`http://127.0.0.1:${selfPort}/api/auth/login/verify`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(mockBody),
            });

            const json = await res.json();
            console.log(`[MockLogin] Status: ${res.status}, Body:`, json);
            const cookie = res.headers.get("Set-Cookie") || "";
            set.headers["Set-Cookie"] = cookie;
            set.status = res.status;
            return json;
        })
        .all("/*", async ({ request }) => {
            console.log(`[BetterAuth Fallback] Hit for ${request.url}`);
            return auth.handler(request);
        });
};
