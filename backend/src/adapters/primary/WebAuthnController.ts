import { Elysia, t } from "elysia";
import { type PasskeyRepository } from "../../core/ports/PasskeyRepository";
import { DateProvider } from "../../core/ports/DateProvider";
import { auth } from "../../lib/auth";
import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { isoUint8Array } from "@simplewebauthn/server/helpers";
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
                    id: passkey.credentialID,
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

            if (isTestOrDev && (body as any).mock === true) {
                await passkeyRepo.save({
                    userId,
                    webauthnUserId: userId,
                    credentialID: new Uint8Array([1, 2, 3, 4]),
                    credentialPublicKey: new Uint8Array([5, 6, 7, 8]),
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
                    response: body as any,
                    expectedChallenge,
                    expectedOrigin: origin,
                    expectedRPID: rpID,
                });

                if (verification.verified && verification.registrationInfo) {
                    const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;

                    await passkeyRepo.save({
                        userId,
                        webauthnUserId: userId,
                        credentialID,
                        credentialPublicKey,
                        counter,
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
