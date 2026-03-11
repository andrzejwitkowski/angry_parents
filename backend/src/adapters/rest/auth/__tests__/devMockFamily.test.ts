import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { connectMongoMemory, disconnectMongoMemory } from "../../../mongo/__tests__/mongoMemoryServer";
import { Family } from "../../../mongo/models/FamilyModel";
import { DEFAULT_DEMO_CHILD, ensureMockFamily } from "../devMockFamily";

describe("ensureMockFamily", () => {
    beforeEach(async () => {
        await connectMongoMemory();
        await Family.deleteMany({});
    });

    afterAll(async () => {
        await disconnectMongoMemory();
    });

    it("creates a mock family with stable parents and no children", async () => {
        const result = await ensureMockFamily({
            dadUserId: "mock-user-id-dev-test-stable",
            momUserId: "dummy-mom-id-stable",
            devPublicKey: "dev-public-key"
        });

        expect(result.parentIds).toEqual([
            "mock-user-id-dev-test-stable",
            "dummy-mom-id-stable"
        ]);
        expect(result.parentPublicKeys.map(({ parentId, role, rsaPublicKeyBase64 }) => ({
            parentId,
            role,
            rsaPublicKeyBase64
        }))).toEqual([
            {
                parentId: "mock-user-id-dev-test-stable",
                role: "dad",
                rsaPublicKeyBase64: "dev-public-key"
            },
            {
                parentId: "dummy-mom-id-stable",
                role: "mom",
                rsaPublicKeyBase64: "dev-public-key"
            }
        ]);
        expect(result.children).toEqual([]);

        const stored = await Family.findOne({ name: "Mock Family" }).lean();
        expect(stored).not.toBeNull();
        expect(stored?.children).toEqual([]);
    });

    it("is idempotent and refreshes parent key material", async () => {
        const first = await ensureMockFamily({
            dadUserId: "mock-user-id-dev-test-stable",
            momUserId: "dummy-mom-id-stable",
            devPublicKey: "old-key"
        });

        const second = await ensureMockFamily({
            dadUserId: "mock-user-id-dev-test-stable",
            momUserId: "dummy-mom-id-stable",
            devPublicKey: "new-key"
        });

        expect(String(second._id)).toBe(String(first._id));
        expect(second.parentIds).toEqual([
            "mock-user-id-dev-test-stable",
            "dummy-mom-id-stable"
        ]);
        expect(second.parentPublicKeys.map(({ parentId, role, rsaPublicKeyBase64 }) => ({
            parentId,
            role,
            rsaPublicKeyBase64
        }))).toEqual([
            {
                parentId: "mock-user-id-dev-test-stable",
                role: "dad",
                rsaPublicKeyBase64: "new-key"
            },
            {
                parentId: "dummy-mom-id-stable",
                role: "mom",
                rsaPublicKeyBase64: "new-key"
            }
        ]);

        expect(await Family.countDocuments({ name: "Mock Family" })).toBe(1);
    });

    it("can seed one stable demo child when requested", async () => {
        const result = await ensureMockFamily({
            dadUserId: "mock-user-id-dev-test-stable",
            momUserId: "dummy-mom-id-stable",
            devPublicKey: "dev-public-key",
            includeDemoChild: true
        });

        expect(result.children.map(({ id, name, icon, color }) => ({ id, name, icon, color }))).toEqual([DEFAULT_DEMO_CHILD]);
    });
});
