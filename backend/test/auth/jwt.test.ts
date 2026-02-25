import { describe, expect, it, beforeAll } from "bun:test";
import { signJwt, verifyJwt, generateJwtSecret } from "../../src/lib/jwt";

describe("JWT", () => {
    it("should sign and verify a valid token", async () => {
        const payload = {
            userId: "user-123",
            familyId: "family-456",
            role: "parent_a" as const,
            gender: "dad" as const,
        };

        const token = await signJwt(payload);
        expect(token).toBeDefined();
        expect(token.split(".")).toHaveLength(3);

        const verified = await verifyJwt(token);
        expect(verified).not.toBeNull();
        expect(verified?.userId).toBe("user-123");
        expect(verified?.familyId).toBe("family-456");
        expect(verified?.role).toBe("parent_a");
        expect(verified?.gender).toBe("dad");
    });

    it("should return null for invalid token", async () => {
        const verified = await verifyJwt("invalid.token.here");
        expect(verified).toBeNull();
    });

    it("should return null for tampered token", async () => {
        const token = await signJwt({ userId: "user-123", familyId: "fam-1" });
        const parts = token.split(".");
        const tampered = parts[0] + "." + "tampered" + "." + parts[2];
        
        const verified = await verifyJwt(tampered);
        expect(verified).toBeNull();
    });

    it("should generate a secure random secret", () => {
        const secret = generateJwtSecret();
        expect(secret).toBeDefined();
        expect(typeof secret).toBe("string");
        expect(secret.length).toBeGreaterThan(20);
    });
});
