import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { connectMongoMemory, disconnectMongoMemory } from "../../adapters/mongo/__tests__/mongoMemoryServer";
import { Family } from "../../adapters/mongo/models/FamilyModel";
import { TaskType } from "../../scheduler/types";
import * as wireDependenciesModule from "../wireDependencies";
const scheduleMock = vi.fn();
const registerHandlerMock = vi.fn();

const createMockDeps = () => ({
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
    eventProofReconciliationService: {},
    timelineMutationRequestRepository: { ensureIndexes: vi.fn().mockResolvedValue(undefined) },
    taskOutboxRepository: { ensureIndexes: vi.fn().mockResolvedValue(undefined) },
    taskOutboxDispatcher: { dispatchNext: vi.fn().mockResolvedValue(false) },
    timelineRepository: {},
    custodyRepository: {}
});

vi.mock("../../scheduler/instance", () => ({
    taskManager: {
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn(),
        schedule: scheduleMock,
        registerHandler: registerHandlerMock
    }
}));

describe("createApp dev seed endpoint", () => {
    const originalEnv = { ...process.env };

    beforeAll(() => {
        process.env.ENABLE_TEST_ENDPOINTS = "true";
        process.env.NODE_ENV = "development";
    });

    beforeEach(() => {
        vi.restoreAllMocks();
        vi.spyOn(wireDependenciesModule, "wireDependencies").mockResolvedValue(createMockDeps() as any);
        scheduleMock.mockReset();
        registerHandlerMock.mockReset();
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

    it("registers the reconciliation task handler during app creation", async () => {
        const { createApp } = await import("../createApp");

        await createApp();

        const registeredTaskTypes = registerHandlerMock.mock.calls.map((call: any[]) => call[0]);
        expect(registeredTaskTypes).toContain(TaskType.RECONCILE_EVENT_PROOF);
    });

    it("exposes a delayed-receipt test endpoint for recovery smoke coverage", async () => {
        process.env.E2E_TEST = "true";
        const delayNextReceipt = vi.fn();
        const getSubmitCount = vi.fn().mockReturnValue(1);
        const publishProof = vi.fn().mockResolvedValue({
            status: "SUBMITTED",
            hash: "a".repeat(64),
            submittedTxHash: `0x${"b".repeat(64)}`
        });
        vi.spyOn(wireDependenciesModule, "wireDependencies").mockResolvedValue({
            ...createMockDeps(),
            blockchainAnchor: { delayNextReceipt, getSubmitCount },
            timelineEventProofService: { publishProof },
        } as any);

        const { createApp } = await import("../createApp");
        const { app } = await createApp();

        const response = await app.handle(new Request("http://localhost/api/test/events/delay-receipt", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({})
        }));

        expect(response.status).toBe(200);
        expect(delayNextReceipt).toHaveBeenCalledTimes(1);
        expect(publishProof).not.toHaveBeenCalled();

        delete process.env.E2E_TEST;
    });

    it("exposes blockchain submit stats for smoke assertions", async () => {
        process.env.E2E_TEST = "true";
        vi.spyOn(wireDependenciesModule, "wireDependencies").mockResolvedValue({
            ...createMockDeps(),
            blockchainAnchor: { getSubmitCount: () => 2 },
        } as any);

        const { createApp } = await import("../createApp");
        const { app } = await createApp();

        const response = await app.handle(new Request("http://localhost/api/test/events/blockchain-stats"));

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ submitCount: 2 });

        delete process.env.E2E_TEST;
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
