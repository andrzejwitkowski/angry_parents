import { Elysia, t } from "elysia";
import { auth } from "../../lib/auth";
import { Family } from "../../models/Family";
import { Invitation, type Gender } from "../../models/Invitation";
import { RegistrationStatus, ParentRegistrationStatus } from "../../models/RegistrationProcess";
import { generateDevRSAKeyPair } from "../secondary/BunCryptoService";
import { MongoRegistrationProcessRepository } from "../secondary/MongoRegistrationProcessRepository";
import { ChildModel } from "../../models/Child";
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
let cachedDevKeyPair: { publicKey: string; privateKey: string } | null = null;

async function getDevKeyPair() {
    if (!cachedDevKeyPair) {
        cachedDevKeyPair = await generateDevRSAKeyPair();
    }
    return cachedDevKeyPair;
}

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

function clearCookie(): string {
    const isProd = process.env.NODE_ENV === "production";
    const secure = isProd ? "; Secure" : "";
    const sameSite = isProd ? "Strict" : "Lax";
    return `token=; HttpOnly${secure}; SameSite=${sameSite}; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
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
                    token: string; // Token is now mandatory
                };

                const isMock = !!mock;
                const isDev = process.env.NODE_ENV !== "production";

                if (!token) {
                    set.status = 400;
                    return { message: "Registration token is required" };
                }

                let userId: string;
                let credentialId = "mock-credential";
                let familyIdToUse: string | undefined;

                // Invitation must exist for the given token
                const invitation = await Invitation.findOne({ token, status: "pending", targetRole: { $in: ["dad", "mom"] } });
                if (!invitation) {
                    set.status = 400;
                    return { message: "Invalid or expired invitation token" };
                }
                familyIdToUse = invitation.familyId.toString();
                const invitationRole = invitation.targetRole as "dad" | "mom";
                console.log(`[Register] Token valid. Joining family: ${familyIdToUse} as ${invitationRole}`);

                // Mark invitation as accepted
                invitation.status = "accepted";
                await invitation.save();

                if (isDev && isMock) {
                    userId = new mongoose.Types.ObjectId().toString();
                    console.log("[Register] Mock mode, generated userId:", userId);
                } else {
                    console.log("[Register] WebAuthn mode for", tempEmail);
                    const emailToVerify = tempEmail || invitation.email;

                    if (!emailToVerify) {
                        set.status = 400;
                        return { message: "Missing email for verification" };
                    }
                    const expectedChallenge = registrationChallenges.get(emailToVerify);
                    if (!expectedChallenge) {
                        console.error("[Register] Challenge not found or expired for", emailToVerify);
                        set.status = 400;
                        return { message: "Challenge not found or expired" };
                    }
                    try {
                        console.log("[Register] Verifying registration response...");
                        const verification = await verifyRegistrationResponse({
                            // @ts-expect-error - WebAuthn types
                            response: registrationResponse,
                            expectedChallenge,
                            expectedOrigin: origin,
                            expectedRPID: rpID,
                        });

                        if (!verification.verified || !verification.registrationInfo) {
                            console.error("[Register] Verification failed:", verification);
                            set.status = 400;
                            return { message: "Verification failed" };
                        }
                        console.log("[Register] Registration response verified successfully.");

                        const info = verification.registrationInfo!;
                        credentialId = typeof info.credential.id === 'string'
                            ? info.credential.id
                            : isoBase64URL.fromBuffer(info.credential.id);
                        userId = new mongoose.Types.ObjectId().toString(); // Generate a new ObjectId for the user
                        console.log(`[Register] Generated userId: ${userId}, credentialId: ${credentialId}`);
                    } catch (e) {
                        console.error("[Register] Verification error", e);
                        set.status = 400;
                        return { message: e instanceof Error ? e.message : "Verification failed" };
                    }
                }

                const family = await Family.findById(familyIdToUse);
                if (!family) {
                    throw new Error("Family not found");
                }

                if (!family.parentIds.includes(userId)) {
                    family.parentIds.push(userId);
                    await family.save();
                }

                const finalEmail = invitation.email || "unknown@example.com";

                const baUser = await createBetterAuthUser(
                    finalEmail!,
                    tempName || "Parent",
                    tempUsername || finalEmail!.split("@")[0],
                    tempGender || invitationRole,
                    family._id.toString(),
                    credentialId
                );
                console.log(`[Register] BetterAuth user created for ${finalEmail}, userId: ${baUser.userId}`);

                if (!isMock && finalEmail) {
                    registrationChallenges.delete(finalEmail);
                    console.log(`[Register] Deleted challenge for ${finalEmail}`);
                }

                // Update Registration Process
                const regProcess = await registrationRepo.findByFamilyId(family._id.toString());
                const roleUsed = invitationRole;

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
                            message: translate("admin.log.registration_completed") as string,
                            timestamp: new Date()
                        });
                    }

                    regProcess.timeline.push({
                        type: "PARENT_REGISTERED",
                        message: translate("admin.log.parent_a_registered", { email: finalEmail }) as string,
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
                console.error("[Register] verify error:", err);
                set.status = 500;
                return { message: err instanceof Error ? err.message : "Internal error" };
            }
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
                // Use stable deterministic IDs so the JWT matches the Child collection across test runs
                const MOCK_USER_ID = "mock-user-id-dev-test-stable";
                const MOCK_FAMILY_ID = "000000000000deadbeef0001";
                const MOCK_CHILD_ID = "000000000000deadbeef0002";
                const finalUserId = userId || MOCK_USER_ID;
                const finalFamilyId = MOCK_FAMILY_ID;
                console.log(`[Login] Mock login for userId: ${finalUserId}`);

                // MOCK IN DB - use upsert to avoid duplicate key errors across test runs
                try {
                    const devKeyPair = await getDevKeyPair();
                    const devRsaPublicKey = devKeyPair.publicKey;
                    const DUMMY_DAD_ID = "dummy-dad-id-stable";
                    const DUMMY_MOM_ID = "dummy-mom-id-stable";

                    await Family.findByIdAndUpdate(
                        finalFamilyId,
                        {
                            _id: finalFamilyId,
                            name: "Mock Family",
                            parentIds: [finalUserId, DUMMY_MOM_ID], // Ensure 2 IDs for encryption logic
                            children: [{ id: MOCK_CHILD_ID, name: "Mock Child" }],
                            custodyPatterns: [],
                            parentPublicKeys: [
                                { parentId: finalUserId, role: "dad", rsaPublicKeyBase64: devRsaPublicKey },
                                { parentId: DUMMY_MOM_ID, role: "mom", rsaPublicKeyBase64: devRsaPublicKey }
                            ]
                        },
                        { upsert: true, new: true }
                    );
                    // Also upsert Child collection so ChildRepository can find it
                    await ChildModel.findOneAndUpdate(
                        { id: MOCK_CHILD_ID },
                        {
                            id: MOCK_CHILD_ID,
                            name: "Mock Child",
                            icon: "user",
                            color: "#7C3AED",
                            familyId: finalFamilyId
                        },
                        { upsert: true, new: true }
                    );
                } catch (e) {
                    console.log("[Login] Mock DB Insert error", e);
                }

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
            set.headers["Set-Cookie"] = clearCookie();
            set.headers["Content-Type"] = "application/json";
            return { ok: true };
        })
        .post("/mock-register", async ({ body, set }) => {
            const isDev = process.env.NODE_ENV !== "production";
            if (!isDev) {
                set.status = 403;
                return { message: "Dev endpoint only" };
            }
            console.log("[MockReg] hit", body);
            const { email, name, gender, token } = body as { email: string, name: string, gender: Gender, token?: string };

            let familyIdToUse: string;
            let finalGender = gender;
            let finalEmail = email;

            if (token) {
                const invitation = await Invitation.findOne({ token, status: "pending" });
                if (!invitation) {
                    set.status = 400;
                    return { message: "Invalid or expired invitation token" };
                }
                familyIdToUse = invitation.familyId.toString();
                finalGender = invitation.targetRole as Gender;
                finalEmail = invitation.email || email;

                invitation.status = "accepted";
                await invitation.save();
            } else {
                const devKeyPair = await getDevKeyPair();
                const devRsaPublicKey = devKeyPair.publicKey;
                const newFamily = await Family.create({
                    parentIds: [],
                    parentPublicKeys: [
                        { parentId: "dummy-dad-id", role: "dad", rsaPublicKeyBase64: devRsaPublicKey },
                        { parentId: "dummy-mom-id", role: "mom", rsaPublicKeyBase64: devRsaPublicKey }
                    ]
                });
                familyIdToUse = newFamily._id.toString();
            }

            const userId = new mongoose.Types.ObjectId().toString();
            const family = await Family.findById(familyIdToUse);
            if (family && !family.parentIds.includes(userId)) {
                family.parentIds.push(userId);
                await family.save();
            }

            // Update RegistrationProcess if one exists for this family (token-based flow)
            if (token) {
                const regProcess = await registrationRepo.findByFamilyId(familyIdToUse);
                if (regProcess) {
                    if (finalGender === "dad") {
                        regProcess.dadStatus = ParentRegistrationStatus.REGISTERED;
                        regProcess.dadRegisteredAt = new Date();
                    } else {
                        regProcess.momStatus = ParentRegistrationStatus.REGISTERED;
                        regProcess.momRegisteredAt = new Date();
                    }

                    if (regProcess.dadStatus === ParentRegistrationStatus.REGISTERED && regProcess.momStatus === ParentRegistrationStatus.REGISTERED) {
                        regProcess.status = RegistrationStatus.COMPLETED;
                        regProcess.timeline.push({
                            type: RegistrationStatus.COMPLETED,
                            message: translate("admin.log.registration_completed") as string,
                            timestamp: new Date()
                        });
                    }

                    regProcess.timeline.push({
                        type: "PARENT_REGISTERED",
                        message: translate("admin.log.parent_a_registered", { email: finalEmail }) as string,
                        timestamp: new Date()
                    });
                    await registrationRepo.save(regProcess);
                }
            }

            const jwtToken = await signJwt({
                userId,
                email: finalEmail,
                role: finalGender,
                gender: finalGender,
                familyId: familyIdToUse
            });

            set.headers["Set-Cookie"] = setCookie(jwtToken);
            set.headers["Content-Type"] = "application/json";

            return { verified: true, role: finalGender };
        })
        .post("/mock-login", async ({ body, set }) => {
            const isDev = process.env.NODE_ENV !== "production";
            if (!isDev) {
                set.status = 403;
                return { message: "Dev endpoint only" };
            }

            const mockBody = (body || {}) as { userId?: string };
            const finalUserId = mockBody.userId || new mongoose.Types.ObjectId().toString();
            const DUMMY_MOM_ID = "dummy-mom-id-stable";
            let finalFamilyId = "";

            // MOCK IN DB
            try {
                let family = await Family.findOne({ name: "Mock Family" });
                if (family) {
                    finalFamilyId = family._id.toString();
                    if (!family.parentIds.includes(finalUserId)) {
                        family.parentIds.push(finalUserId);
                    }
                    if (!family.parentIds.includes(DUMMY_MOM_ID)) {
                        family.parentIds.push(DUMMY_MOM_ID);
                    }
                    const devKeyPair = await getDevKeyPair();
                    const devRsaPublicKey = devKeyPair.publicKey;
                    const parentPublicKeys = family.parentPublicKeys || [];
                    if (!parentPublicKeys.find((k) => k.parentId === finalUserId)) {
                        parentPublicKeys.push({ parentId: finalUserId, role: "dad", rsaPublicKeyBase64: devRsaPublicKey });
                    }
                    if (!parentPublicKeys.find((k) => k.parentId === DUMMY_MOM_ID)) {
                        parentPublicKeys.push({ parentId: DUMMY_MOM_ID, role: "mom", rsaPublicKeyBase64: devRsaPublicKey });
                    }
                    family.parentPublicKeys = parentPublicKeys;
                    await family.save();
                } else {
                    const devKeyPair = await getDevKeyPair();
                    const devRsaPublicKey = devKeyPair.publicKey;
                    finalFamilyId = new mongoose.Types.ObjectId().toString();
                    family = new Family({
                        _id: finalFamilyId,
                        name: "Mock Family",
                        parentIds: [finalUserId, DUMMY_MOM_ID],
                        children: [],
                        custodyPatterns: [],
                        parentPublicKeys: [
                            { parentId: finalUserId, role: "dad", rsaPublicKeyBase64: devRsaPublicKey },
                            { parentId: DUMMY_MOM_ID, role: "mom", rsaPublicKeyBase64: devRsaPublicKey }
                        ]
                    });
                    await family.save();
                }
            } catch (e) {
                console.log("[Login] Mock DB error", e);
                finalFamilyId = new mongoose.Types.ObjectId().toString();
            }

            const token = await signJwt({
                userId: finalUserId,
                familyId: finalFamilyId,
                role: "dad",
                gender: "dad",
            });
            console.log(`[MockLogin] Mock login for userId: ${finalUserId}`);
            set.headers["Set-Cookie"] = setCookie(token);
            set.headers["Content-Type"] = "application/json";
            return { verified: true };
        })
        .all("/*", async ({ request }) => {
            console.log(`[BetterAuth Fallback] Hit for ${request.url}`);
            return auth.handler(request);
        });
};
