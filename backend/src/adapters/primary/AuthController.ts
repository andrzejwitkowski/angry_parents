import { Elysia, t } from "elysia";
import { auth } from "../../lib/auth";
import { Family } from "../../models/Family";
import { Invitation, type Gender } from "../../models/Invitation";
import { RegistrationStatus } from "../../models/RegistrationProcess";
import { MongoRegistrationProcessRepository } from "../secondary/MongoRegistrationProcessRepository";
import { signJwt, verifyJwt } from "../../lib/jwt";
import { sendInvitationEmail } from "../../lib/email";
import {
    generateRegistrationOptions,
    generateAuthenticationOptions,
    verifyRegistrationResponse,
    verifyAuthenticationResponse,
} from "@simplewebauthn/server";
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
        .post("/register/parent-a/options", async ({ body, set }) => {
            console.log("[ParentA] options hit");
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
        .post("/register/parent-a/verify", async ({ body, set }) => {
            console.log("[ParentA] verify hit", JSON.stringify(body));
            try {
                const { registrationResponse, tempEmail, tempName, tempUsername, tempGender, mock } = body as {
                    registrationResponse?: unknown;
                    tempEmail?: string;
                    tempName?: string;
                    tempUsername?: string;
                    tempGender?: Gender;
                    mock?: boolean;
                };

                const isMock = !!mock;
                const isDev = process.env.NODE_ENV !== "production";

                let userId: string;
                let credentialId = "mock-credential";

                if (isDev && isMock) {
                    userId = new mongoose.Types.ObjectId().toString();
                    console.log("[ParentA] Mock mode, generated userId:", userId);
                } else {
                    console.log("[ParentA] WebAuthn mode for", tempEmail);
                    if (!tempEmail) {
                        set.status = 400;
                        return { message: "Missing tempEmail" };
                    }
                    const expectedChallenge = registrationChallenges.get(tempEmail!);
                    if (!expectedChallenge) {
                        console.error("[ParentA] Challenge not found or expired for", tempEmail);
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

                console.log(`[ParentA] Creating family for userId: ${userId}`);
                const family = new Family({
                    parentIds: [userId],
                    children: [],
                    custodyPatterns: [],
                });
                await family.save();
                console.log(`[ParentA] Family created: ${family._id}`);

                const baUser = await createBetterAuthUser(
                    tempEmail!,
                    tempName || "Parent A",
                    tempUsername || tempEmail!.split("@")[0],
                    tempGender,
                    family._id.toString(),
                    credentialId
                );
                console.log(`[ParentA] BetterAuth user created for ${tempEmail}, userId: ${baUser.userId}`);

                if (!isMock) {
                    registrationChallenges.delete(tempEmail!);
                    console.log(`[ParentA] Deleted challenge for ${tempEmail}`);
                }

                // Update Registration Process
                const regProcess = await registrationRepo.findByFamilyId(family._id.toString());
                if (regProcess) {
                    regProcess.status = RegistrationStatus.PARENT_A_VALIDATED;
                    regProcess.timeline.push({
                        type: RegistrationStatus.PARENT_A_VALIDATED,
                        message: `Rodzic A (${tempEmail}) zweryfikował tożsamość.`,
                        timestamp: new Date()
                    });
                    await registrationRepo.save(regProcess);
                }

                const token = await signJwt({
                    userId: baUser.userId,
                    familyId: family._id.toString(),
                    role: "parent_a",
                    gender: tempGender,
                });
                console.log("[ParentA] JWT signed.");

                set.headers["Set-Cookie"] = setCookie(token);
                set.headers["Content-Type"] = "application/json";
                console.log("[ParentA] verify success");
                return { verified: true, role: "parent_a" };
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
            console.log(`[Invite] Generated invite token: ${inviteToken} for ${email}`);

            const invitation = new Invitation({
                token: inviteToken,
                email,
                familyId: payload.familyId,
                invitedBy: payload.userId,
                createdByGender: inviterGender,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                status: "pending",
            });
            await invitation.save();
            console.log(`[Invite] Invitation saved for ${email}`);

            const inviterName = "Twój partner";
            const link = await sendInvitationEmail(email, inviteToken, inviterName);
            console.log(`[Invite] Invitation email sent to ${email}`);

            // Update Registration Process
            const regProcess = await registrationRepo.findByFamilyId(payload.familyId);
            if (regProcess) {
                regProcess.status = RegistrationStatus.INVITATION_SENT;
                regProcess.parentBEmail = email;
                regProcess.timeline.push({
                    type: RegistrationStatus.INVITATION_SENT,
                    message: `Wysłano zaproszenie do drugiego rodzica: ${email}`,
                    timestamp: new Date()
                });
                await registrationRepo.save(regProcess);
            }

            set.headers["Content-Type"] = "application/json";
            return { token: inviteToken, link };
        }, {
            body: t.Object({
                email: t.String(),
            }),
        })
        .get("/register/parent-b/options", async ({ query, set }) => {
            console.log("[ParentB] options hit");
            const { token } = query as { token?: string };

            if (!token) {
                set.status = 400;
                return { message: "Token is required" };
            }

            const invitation = await Invitation.findOne({ token, status: "pending" });

            if (!invitation) {
                set.status = 400;
                return { message: "Invalid or expired invitation" };
            }

            if (invitation.expiresAt < new Date()) {
                invitation.status = "expired";
                await invitation.save();
                set.status = 400;
                return { message: "Invitation expired" };
            }
            console.log(`[ParentB] Invitation found for ${invitation.email}`);

            const options = await generateRegistrationOptions({
                rpName,
                rpID,
                userID: isoUint8Array.fromUTF8String(invitation.email),
                userName: invitation.email,
                attestationType: 'none',
                authenticatorSelection: {
                    userVerification: 'preferred',
                    residentKey: 'preferred',
                },
            });
            console.log(`[ParentB] Generated registration options for ${invitation.email}, challenge: ${options.challenge}`);
            registrationChallenges.set(token, options.challenge);

            set.headers["Content-Type"] = "application/json";
            return {
                ...options,
                tempToken: token,
                tempFamilyId: invitation.familyId.toString(),
                tempCreatedByGender: invitation.createdByGender,
            };
        })
        .post("/register/parent-b/verify", async ({ body, set }) => {
            console.log("[ParentB] verify hit", JSON.stringify(body));
            const bodyData = body as {
                registrationResponse?: unknown;
                tempToken?: string;
                tempFamilyId?: string;
                tempCreatedByGender?: Gender;
                gender?: Gender;
                mock?: boolean;
            };

            const { registrationResponse, tempToken, tempFamilyId, tempCreatedByGender, gender, mock } = bodyData;

            const isDev = process.env.NODE_ENV !== "production";
            const isMock = bodyData.mock;

            if (!isMock) {
                if (!tempToken || !tempFamilyId) {
                    set.status = 400;
                    return { message: "Missing token or familyId" };
                }

                const expectedChallenge = registrationChallenges.get(tempToken);
                if (!expectedChallenge) {
                    set.status = 400;
                    return { message: "Challenge not found or expired" };
                }
            }

            if (gender === tempCreatedByGender) {
                set.status = 400;
                return {
                    message: `Drugi rodzic musi być ${tempCreatedByGender === "mom" ? "tatą" : "mamą"}`,
                };
            }

            const invitation = await Invitation.findOne({ token: tempToken, status: "pending" });
            if (!invitation) {
                set.status = 400;
                return { message: "Invalid invitation" };
            }
            console.log(`[ParentB] Invitation found for ${invitation.email}`);

            let userId: string;
            let credentialId = "mock-credential";

            if (isDev && isMock) {
                userId = new mongoose.Types.ObjectId().toString(); // Use valid ObjectId
                console.log("[ParentB] Mock mode, generated userId:", userId);
            } else {
                const expectedChallenge = registrationChallenges.get(tempToken!)!;
                try {
                    console.log("[ParentB] Verifying registration response...");
                    const verification = await verifyRegistrationResponse({
                        // @ts-expect-error - WebAuthn types
                        response: registrationResponse,
                        expectedChallenge: expectedChallenge!,
                        expectedOrigin: origin,
                        expectedRPID: rpID,
                    });

                    if (!verification.verified || !verification.registrationInfo) {
                        console.error("[ParentB] Verification failed:", verification);
                        set.status = 400;
                        return { message: "Verification failed" };
                    }
                    console.log("[ParentB] Registration response verified successfully.");

                    const info = verification.registrationInfo!;
                    credentialId = typeof info.credential.id === 'string'
                        ? info.credential.id
                        : isoBase64URL.fromBuffer(info.credential.id);
                    userId = new mongoose.Types.ObjectId().toString(); // Generate a new ObjectId for the user
                    console.log(`[ParentB] Generated userId: ${userId}, credentialId: ${credentialId}`);
                } catch (e) {
                    console.error("[ParentB] Verification error", e);
                    set.status = 400;
                    return { message: e instanceof Error ? e.message : "Verification failed" };
                }
            }

            const baUser = await createBetterAuthUser(
                invitation.email,
                "Parent B",
                invitation.email.split("@")[0],
                gender,
                tempFamilyId,
                credentialId
            );
            console.log(`[ParentB] BetterAuth user created for ${invitation.email}, userId: ${baUser.userId}`);

            console.log(`[ParentB] Adding user ${baUser.userId} to family ${tempFamilyId}`);
            await Family.findByIdAndUpdate(tempFamilyId, {
                $addToSet: { parentIds: baUser.userId },
            });
            console.log(`[ParentB] User ${baUser.userId} added to family ${tempFamilyId}`);

            invitation.status = "accepted";
            await invitation.save();
            console.log(`[ParentB] Invitation ${tempToken} accepted.`);
            registrationChallenges.delete(tempToken!);
            console.log(`[ParentB] Deleted challenge for ${tempToken}`);

            // Update Registration Process
            const regProcess = await registrationRepo.findByFamilyId(tempFamilyId);
            if (regProcess) {
                regProcess.status = RegistrationStatus.COMPLETED;
                regProcess.parentBName = "Parent B"; // Potential improvement: get name from body
                regProcess.timeline.push({
                    type: RegistrationStatus.COMPLETED,
                    message: "Drugi rodzic ukończył rejestrację. Proces zakończony.",
                    timestamp: new Date()
                });
                await registrationRepo.save(regProcess);
            }

            const token = await signJwt({
                userId: baUser.userId,
                familyId: tempFamilyId,
                role: "parent_b",
                gender: gender,
            });
            console.log("[ParentB] JWT signed.");

            set.headers["Set-Cookie"] = setCookie(token);
            set.headers["Content-Type"] = "application/json";
            return { verified: true, role: "parent_b" };
        }, {
            body: t.Any(),
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
                    role: "parent_a",
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
        .post("/mock-register-a", async ({ body, set }) => {
            console.log("[MockRegA] hit");
            const isDev = process.env.NODE_ENV !== "production";
            if (!isDev) {
                set.status = 403;
                return { message: "Dev endpoint only" };
            }

            const { email, name, gender } = body as {
                email: string;
                name: string;
                gender: Gender;
            };

            if (!email || !name || !gender) {
                set.status = 400;
                return { message: "Missing required fields" };
            }

            try {
                // Inline mock logic — no internal HTTP call, no BetterAuth (avoids hangs)
                const userId = new mongoose.Types.ObjectId().toString();
                console.log("[MockRegA] Generated userId:", userId);

                const family = new Family({
                    parentIds: [userId],
                    children: [],
                    custodyPatterns: [],
                });
                await family.save();
                console.log("[MockRegA] Family created:", family._id.toString());

                const token = await signJwt({
                    userId,
                    familyId: family._id.toString(),
                    role: "parent_a",
                    gender,
                });
                console.log("[MockRegA] JWT signed for", email);

                set.headers["Set-Cookie"] = setCookie(token);
                set.headers["Content-Type"] = "application/json";
                return { verified: true, role: "parent_a" };
            } catch (err) {
                console.error("[MockRegA] error:", err);
                set.status = 500;
                return { message: err instanceof Error ? err.message : "Internal error" };
            }
        })
        .post("/mock-register-b", async ({ body, set }) => {
            console.log("[MockRegB] hit");
            const isDev = process.env.NODE_ENV !== "production";
            if (!isDev) {
                set.status = 403;
                return { message: "Dev endpoint only" };
            }

            const { token, gender } = body as {
                token?: string;
                gender?: Gender;
            };

            if (!token || !gender) {
                set.status = 400;
                return { message: "Missing token or gender" };
            }

            const invitation = await Invitation.findOne({ token, status: "pending" });
            if (!invitation) {
                set.status = 400;
                return { message: "Invalid invitation" };
            }

            const mockBody = {
                mock: true,
                tempToken: token,
                tempFamilyId: invitation.familyId.toString(),
                tempCreatedByGender: invitation.createdByGender,
                gender,
            };

            // Use dynamic port so this works under any test runner (port 3000 locally, 3002 in npm run test)
            const selfPort = process.env.PORT || "3000";
            const res = await fetch(`http://127.0.0.1:${selfPort}/api/auth/register/parent-b/verify`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(mockBody),
            });

            const json = await res.json();
            console.log(`[MockRegB] Status: ${res.status}, Body:`, json);
            const cookie = res.headers.get("Set-Cookie") || "";
            set.headers["Set-Cookie"] = cookie;
            set.status = res.status;
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
