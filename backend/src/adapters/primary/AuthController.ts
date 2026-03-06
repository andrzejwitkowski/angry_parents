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
                extensions: {
                    // @ts-ignore - PRF extension type might be missing in some versions
                    prf: {}
                }
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
                const {
                    registrationResponse,
                    tempEmail,
                    tempName,
                    tempUsername,
                    tempGender,
                    mock,
                    token,
                    rsaPublicKeyBase64,
                    encryptedRsaPrivateKeyBase64,
                    prfSaltBase64
                } = body as {
                    registrationResponse?: unknown;
                    tempEmail?: string;
                    tempName?: string;
                    tempUsername?: string;
                    tempGender?: Gender;
                    mock?: boolean;
                    token: string;
                    rsaPublicKeyBase64?: string;
                    encryptedRsaPrivateKeyBase64?: string;
                    prfSaltBase64?: string;
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

                const finalEmail = invitation.email || "unknown@example.com";

                const baUser = await createBetterAuthUser(
                    finalEmail!,
                    tempName || "Parent",
                    tempUsername || finalEmail!.split("@")[0],
                    tempGender || invitationRole,
                    family._id.toString(),
                    credentialId
                );
                const actualUserId = baUser.userId;
                console.log(`[Register] BetterAuth user created for ${finalEmail}, actualUserId: ${actualUserId}`);

                if (!family.parentIds.includes(actualUserId)) {
                    family.parentIds.push(actualUserId);

                    const finalRsaPublicKey = rsaPublicKeyBase64 || (isDev ? (await getDevKeyPair()).publicKey : null);

                    if (finalRsaPublicKey) {
                        if (!family.parentPublicKeys) family.parentPublicKeys = [];
                        const existingKey = family.parentPublicKeys.find(
                            (k: any) => k.role === invitationRole
                        );

                        if (existingKey) {
                            existingKey.parentId = actualUserId;
                            existingKey.rsaPublicKeyBase64 = finalRsaPublicKey;
                            existingKey.encryptedRsaPrivateKeyBase64 = encryptedRsaPrivateKeyBase64;
                            existingKey.prfSaltBase64 = prfSaltBase64;
                        } else {
                            family.parentPublicKeys.push({
                                parentId: actualUserId,
                                role: invitationRole,
                                rsaPublicKeyBase64: finalRsaPublicKey,
                                encryptedRsaPrivateKeyBase64,
                                prfSaltBase64
                            } as any);
                        }
                    }
                    await family.save();
                }

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

        .post("/login/options", async ({ body, set }) => {
            console.log("[Login] options hit");
            const { email } = (body || {}) as { email?: string };
            let prfSalt: string | undefined;

            if (email && mongoose.connection.readyState === 1) {
                try {
                    const user = await mongoose.connection.db?.collection("user").findOne({ email });
                    if (user && user.familyId) {
                        const family = await Family.findById(user.familyId);
                        const parentKey = family?.parentPublicKeys.find((k: any) => k.parentId === user.id || k.parentId === user._id.toString());
                        prfSalt = parentKey?.prfSaltBase64;
                    }
                } catch (e) {
                    console.warn("[Login] Failed to lookup PRF salt for email:", email, e);
                }
            }

            const options = await generateAuthenticationOptions({
                rpID,
                userVerification: 'preferred',
                extensions: prfSalt ? {
                    // @ts-ignore
                    prf: { eval: { first: isoBase64URL.fromBuffer(Buffer.from(prfSalt, 'base64')) } }
                } : undefined
            });
            console.log("[Login] Generated authentication options. PRF Salt present:", !!prfSalt);

            set.headers["Content-Type"] = "application/json";
            return {
                ...options,
                prfSaltBase64: prfSalt // Pass back to client so they know which salt was used for the eval challenge
            };
        })
        .post("/login/verify", async ({ body, set }) => {
            console.log("[Login] verify hit", JSON.stringify(body));
            const { email, authenticationResponse, mockLogin, userId } = (body || {}) as {
                email?: string;
                authenticationResponse?: any;
                mockLogin?: boolean;
                userId?: string;
            };
            let verified = false;
            let finalUserId: string | undefined = userId;
            let finalFamilyId: string | undefined;
            let encryptedRsaPrivateKeyBase64: string | undefined;
            let prfSaltBase64: string | undefined;

            const isDev = process.env.NODE_ENV !== "production";
            const MOCK_USER_ID = "mock-user-id-dev-test-stable";
            const MOCK_FAMILY_ID = "000000000000deadbeef0001";
            finalFamilyId = MOCK_FAMILY_ID;

            if (isDev && mockLogin) {
                finalUserId = userId || MOCK_USER_ID;
                console.log(`[Login] Mock login for userId: ${finalUserId}`);
                verified = true;
            } else if (authenticationResponse) {
                try {
                    const credentialId = authenticationResponse.id;
                    const user = await mongoose.connection.db?.collection("user").findOne({ webauthnCredentialId: credentialId });

                    if (!user) {
                        throw new Error("User not found for credential");
                    }

                    verified = true;
                    finalUserId = user.id || user._id.toString();
                    finalFamilyId = user.familyId;

                    const family = await Family.findOne({ parentIds: finalUserId });

                    if (family) {
                        const parent = family.parentPublicKeys.find(
                            (p: any) => p.parentId === finalUserId
                        );

                        if (parent) {
                            encryptedRsaPrivateKeyBase64 = parent.encryptedRsaPrivateKeyBase64;
                            prfSaltBase64 = parent.prfSaltBase64;
                        }
                    }
                } catch (e) {
                    console.error("[Login] Verification error:", e);
                }
            }

            if (verified && finalUserId) {
                const token = await signJwt({
                    userId: finalUserId,
                    familyId: finalFamilyId,
                    role: "dad",
                    gender: "dad",
                });

                // Fallback for mock login if needed
                if (!encryptedRsaPrivateKeyBase64 && finalFamilyId) {
                    try {
                        const family = await Family.findById(finalFamilyId);
                        const parentKey = family?.parentPublicKeys.find((k: any) => k.parentId === finalUserId);
                        encryptedRsaPrivateKeyBase64 = parentKey?.encryptedRsaPrivateKeyBase64;
                        prfSaltBase64 = parentKey?.prfSaltBase64;
                    } catch (e) {
                        console.error("[Login] Failed to fetch PRF material:", e);
                    }
                }

                set.headers["Set-Cookie"] = setCookie(token);
                set.headers["Content-Type"] = "application/json";
                return {
                    verified: true,
                    token,
                    encryptedRsaPrivateKeyBase64,
                    prfSaltBase64
                };
            }

            set.status = 401;
            return { verified: false };
        }, {
            body: t.Any(),
        })
        .post("/public-key", async ({ body, request, set }) => {
            const { rsaPublicKeyBase64, encryptedRsaPrivateKeyBase64, prfSaltBase64 } = body as {
                rsaPublicKeyBase64: string;
                encryptedRsaPrivateKeyBase64: string;
                prfSaltBase64: string;
            };

            const token = getJwtFromCookie(request);
            if (!token) {
                set.status = 401;
                return { message: "Unauthorized" };
            }

            const payload = await verifyJwt(token);
            if (!payload || !payload.userId || !payload.familyId) {
                set.status = 401;
                return { message: "Invalid session" };
            }

            try {
                const family = await Family.findById(payload.familyId);
                if (!family) throw new Error("Family not found");

                const parentKey = family.parentPublicKeys.find((k: any) => k.parentId === payload.userId);
                if (parentKey) {
                    parentKey.rsaPublicKeyBase64 = rsaPublicKeyBase64;
                    parentKey.encryptedRsaPrivateKeyBase64 = encryptedRsaPrivateKeyBase64;
                    parentKey.prfSaltBase64 = prfSaltBase64;
                } else {
                    const user = await mongoose.connection.db?.collection("user").findOne({
                        $or: [{ id: payload.userId }, { _id: new mongoose.Types.ObjectId(payload.userId) }]
                    });
                    const role = (user?.gender === "mom" || user?.role === "mom") ? "mom" : "dad";

                    family.parentPublicKeys.push({
                        parentId: payload.userId,
                        role: role as any,
                        rsaPublicKeyBase64,
                        encryptedRsaPrivateKeyBase64,
                        prfSaltBase64
                    });
                }
                await family.save();
                return { success: true };
            } catch (e) {
                console.error("[Auth] Update public key error:", e);
                set.status = 500;
                return { message: "Internal error" };
            }
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
                        familyId: payload.familyId ? payload.familyId.toString() : null,
                    },
                    family: family ? { ...family, id: family._id.toString(), _id: family._id.toString() } : null
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
            const userId = new mongoose.Types.ObjectId().toString();

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
                const dummyOtherId = finalGender === "dad" ? "dummy-mom-id-stable" : "dummy-dad-id-stable";
                const otherRole = finalGender === "dad" ? "mom" : "dad";

                const newFamily = await Family.create({
                    parentIds: [userId, dummyOtherId],
                    parentPublicKeys: [
                        { parentId: userId, role: finalGender, rsaPublicKeyBase64: devRsaPublicKey },
                        { parentId: dummyOtherId, role: otherRole, rsaPublicKeyBase64: devRsaPublicKey }
                    ]
                });
                familyIdToUse = newFamily._id.toString();
            }

            const family = await Family.findById(familyIdToUse);
            if (family && !family.parentIds.includes(userId)) {
                family.parentIds.push(userId);
                // Also ensure public key is set for this user if it was a token-based registration
                const devKeyPair = await getDevKeyPair();
                const devRsaPublicKey = devKeyPair.publicKey;
                const existingKey = family.parentPublicKeys.find(
                    (k: { parentId: string; role: string; rsaPublicKeyBase64: string }) =>
                        k.parentId === userId || k.role === finalGender
                );
                if (existingKey) {
                    existingKey.parentId = userId;
                    existingKey.rsaPublicKeyBase64 = devRsaPublicKey;
                } else {
                    family.parentPublicKeys.push({ parentId: userId, role: finalGender, rsaPublicKeyBase64: devRsaPublicKey });
                }
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
            const DEFAULT_DEV_DAD_ID = "mock-user-id-dev-test-stable";
            const finalUserId = mockBody.userId || DEFAULT_DEV_DAD_ID;
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

                    // Always ensure dev keys match current environment for both parents in mock family
                    const dadKey = parentPublicKeys.find((k: any) => k.parentId === finalUserId || k.role === "dad");
                    const momKey = parentPublicKeys.find((k: any) => k.parentId === DUMMY_MOM_ID || k.role === "mom");

                    if (dadKey) {
                        dadKey.rsaPublicKeyBase64 = devRsaPublicKey;
                        dadKey.parentId = finalUserId;
                    } else {
                        parentPublicKeys.push({ parentId: finalUserId, role: "dad", rsaPublicKeyBase64: devRsaPublicKey });
                    }

                    if (momKey) {
                        momKey.rsaPublicKeyBase64 = devRsaPublicKey;
                        momKey.parentId = DUMMY_MOM_ID;
                    } else {
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
            console.log(`[MockLogin] Mock login for userId: ${finalUserId}, familyId: ${finalFamilyId}`);
            set.headers["Set-Cookie"] = setCookie(token);
            set.headers["Content-Type"] = "application/json";
            return { verified: true };
        })
        .all("/*", async ({ request }) => {
            console.log(`[BetterAuth Fallback] Hit for ${request.url}`);
            return auth.handler(request);
        });
};
