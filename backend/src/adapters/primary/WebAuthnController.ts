import { Elysia, t } from "elysia";
import { type PasskeyRepository } from "../../core/ports/PasskeyRepository";
import { DateProvider } from "../../core/ports/DateProvider";
import { auth } from "../../lib/auth";
import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { isoUint8Array, isoBase64URL } from "@simplewebauthn/server/helpers";
import type { AuthenticatorTransport } from "@simplewebauthn/typescript-types";

// Challenge storage (Memory)
const challenges = new Map<string, string>();

export const createWebAuthnController = (passkeyRepo: PasskeyRepository, dateProvider: DateProvider) => {
    const rpName = "Angry Parents Co-Parenting";
    const rpID = "localhost";
    const origin = ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"];

    return new Elysia({ prefix: "/api/auth/webauthn" })
        .get("/register/options", async ({ request, set }) => {
            const session = await auth.api.getSession({ headers: request.headers });
            if (!session) {
                set.status = 401;
                return { message: "Unauthorized" };
            }

            const userId = session.user.id;
            const userPasskeys = await passkeyRepo.findByUserId(userId);

            const options = await generateRegistrationOptions({
                rpName,
                rpID,
                userID: isoUint8Array.fromUTF8String(userId),
                userName: session.user.email,
                attestationType: 'none',
                excludeCredentials: userPasskeys.map(passkey => ({
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    id: isoBase64URL.fromBuffer(passkey.credentialID as any),
                    type: 'public-key',
                    transports: passkey.transports as AuthenticatorTransport[],
                })),
                authenticatorSelection: {
                    userVerification: 'preferred',
                    residentKey: 'preferred',
                },
            });

            challenges.set(userId, options.challenge);

            return options;
        })
        .post("/register/verify", async ({ request, body, set }) => {
            const session = await auth.api.getSession({ headers: request.headers });
            if (!session) {
                set.status = 401;
                return { message: "Unauthorized" };
            }

            const userId = session.user.id;
            // Mock Handling (Dev/Test only)
            const nodeEnv = process.env.NODE_ENV || 'development';
            const isTestOrDev = nodeEnv === "test" || nodeEnv === "development" || !process.env.NODE_ENV;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (isTestOrDev && (body as any).mock === true) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const mockBody = body as any;

                // Use provided mock values or fall back to defaults
                const credentialID = mockBody.mockCredentialID
                    ? (typeof mockBody.mockCredentialID === 'string'
                        ? isoBase64URL.toBuffer(mockBody.mockCredentialID)
                        : new Uint8Array(mockBody.mockCredentialID))
                    : new Uint8Array([1, 2, 3, 4]);

                const credentialPublicKey = mockBody.mockCredentialPublicKey
                    ? (typeof mockBody.mockCredentialPublicKey === 'string'
                        ? isoBase64URL.toBuffer(mockBody.mockCredentialPublicKey)
                        : new Uint8Array(mockBody.mockCredentialPublicKey))
                    : new Uint8Array([5, 6, 7, 8]);

                await passkeyRepo.save({
                    userId,
                    webauthnUserId: userId,
                    credentialID,
                    credentialPublicKey,
                    counter: 0,
                    transports: [],
                    name: "Mock Key",
                    createdAt: dateProvider.getNow()
                });
                return { verified: true };
            }

            const expectedChallenge = challenges.get(userId);

            if (!expectedChallenge) {
                set.status = 400;
                return { message: "Challenge not found or expired" };
            }

            try {
                const verification = await verifyRegistrationResponse({
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    response: body as any,
                    expectedChallenge,
                    expectedOrigin: origin,
                    expectedRPID: rpID,
                });

                if (verification.verified && verification.registrationInfo) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const { credentialID, credentialPublicKey, counter } = verification.registrationInfo as any;

                    await passkeyRepo.save({
                        userId,
                        webauthnUserId: userId,
                        credentialID,
                        credentialPublicKey,
                        counter,
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        transports: (body as any).response.transports || [],
                        name: "Hardware Key",
                        createdAt: dateProvider.getNow()
                    });

                    challenges.delete(userId);
                    return { verified: true };
                } else {
                    set.status = 400;
                    return { message: "Verification failed" };
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (e: any) {
                console.error("Verification error", e);
                set.status = 400;
                return { message: e.message };
            }
        }, {
            body: t.Any()
        })
        .get("/status", async ({ request, set }) => {
            const session = await auth.api.getSession({ headers: request.headers });
            if (!session) {
                set.status = 401;
                return { message: "Unauthorized" };
            }

            const count = await passkeyRepo.countByUserId(session.user.id);
            return { hasPasskey: count > 0 };
        });
};
