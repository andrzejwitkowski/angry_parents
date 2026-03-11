import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Elysia } from "elysia";
import { connectMongoMemory, disconnectMongoMemory } from "../../adapters/mongo/__tests__/mongoMemoryServer";
import { Family } from "../../adapters/mongo/models/FamilyModel";

vi.mock("../../scheduler/instance", () => ({
    taskManager: {
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn(),
        schedule: vi.fn(),
        registerHandler: vi.fn()
    }
}));

vi.mock("../registerSchedulerHandlers", () => ({
    registerSchedulerHandlers: vi.fn()
}));

vi.mock("../../adapters/rest/events/TimelineController", () => ({
    createTimelineController: () => new Elysia()
}));

vi.mock("../../adapters/rest/events/CustodyController", () => ({
    createCustodyController: () => new Elysia()
}));

vi.mock("../../adapters/rest/auth/WebAuthnController", () => ({
    createWebAuthnController: () => new Elysia()
}));

vi.mock("../../adapters/rest/auth/AuthController", () => ({
    createAuthController: () => new Elysia()
}));

vi.mock("../../adapters/rest/forensic/ForensicController", () => ({
    createForensicController: () => new Elysia()
}));

vi.mock("../../adapters/rest/family/ChildController", () => ({
    createChildController: () => new Elysia()
}));

vi.mock("../../adapters/rest/auth/AdminController", () => ({
    createAdminController: () => new Elysia()
}));

vi.mock("../wireDependencies", () => ({
    wireDependencies: vi.fn().mockResolvedValue({
        timelineApiService: {},
        custodyApiService: {},
        familyApiService: {},
        passkeyRepository: {},
        dateProvider: { getIsoString: () => "2026-03-11T12:00:00.000Z" },
        registrationProcessRepository: {},
        forensicApiService: {},
        forensicRepository: {},
        cryptoService: {},
        blockchainAnchor: {},
        forensicIntentRepository: {},
        forensicService: {},
        timelineEventProofService: {},
        timelineRepository: {},
        custodyRepository: {}
    })
}));

describe("createApp dev seed endpoint", () => {
    const originalEnv = { ...process.env };

    beforeAll(() => {
        process.env.ENABLE_TEST_ENDPOINTS = "true";
        process.env.NODE_ENV = "development";
    });

    beforeEach(() => {
        return connectMongoMemory().then(async () => {
            await Family.deleteMany({});
        });
    });

    afterAll(() => {
        process.env = originalEnv;
        return disconnectMongoMemory();
    });

    it("seeds mock family via test endpoint", async () => {
        const { createApp } = await import("../createApp");
        const { app } = await createApp();

        const response = await app.handle(new Request("http://localhost/api/test/dev/seed-mock-family", {
            method: "POST"
        }));

        expect(response.status).toBe(200);
        const payload = await response.json();
        expect(payload).toMatchObject({
            status: "seeded",
            parentIds: ["mock-user-id-dev-test-stable", "dummy-mom-id-stable"],
            childrenCount: 0
        });
        expect(payload.familyId).toBeTruthy();

        const stored = await Family.findOne({ name: "Mock Family" }).lean();
        expect(stored?.children).toEqual([]);
    });

    it("seeds mock family with one demo child via demo endpoint", async () => {
        const { createApp } = await import("../createApp");
        const { app } = await createApp();

        const response = await app.handle(new Request("http://localhost/api/test/dev/seed-mock-family-demo", {
            method: "POST"
        }));

        expect(response.status).toBe(200);
        const payload = await response.json();
        expect(payload).toMatchObject({
            status: "seeded",
            parentIds: ["mock-user-id-dev-test-stable", "dummy-mom-id-stable"],
            childrenCount: 1
        });

        const stored = await Family.findOne({ name: "Mock Family" }).lean();
        expect(stored?.children).toEqual([
            {
                id: "mock-child-dev-stable",
                name: "Alex",
                icon: "user",
                color: "#3B82F6"
            }
        ]);
    });
});
