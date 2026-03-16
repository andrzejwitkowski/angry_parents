import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { TaskType } from "../../scheduler/types";

const registerHandler = mock(() => {});
const registerFailureHandler = mock(() => {});
const mockedTaskManager = {
    registerHandler,
    registerFailureHandler,
};

mock.module("../../scheduler/instance", () => ({
    taskManager: mockedTaskManager,
}));

describe("registerSchedulerHandlers", () => {
    beforeEach(() => {
        registerHandler.mockClear();
        registerFailureHandler.mockClear();
        mockedTaskManager.registerHandler = registerHandler;
        mockedTaskManager.registerFailureHandler = registerFailureHandler;
    });

    afterEach(async () => {
        const { taskManager } = await import("../../scheduler/instance");
        (taskManager as any).registerFailureHandler = registerFailureHandler;
    });

    it("registers the reconciliation handler for the event proof task type", async () => {
        const { registerSchedulerHandlers } = await import("../registerSchedulerHandlers");
        const reconcileProof = mock(() => Promise.resolve({ status: "CONFIRMED" }));
        const markProofReconciliationFailed = mock(() => Promise.resolve({ status: "FAILED" }));
        const deps = {
            forensicRepository: { name: "forensicRepository" },
            cryptoService: { name: "cryptoService" },
            passkeyRepository: { name: "passkeyRepository" },
            blockchainAnchor: { name: "blockchainAnchor" },
            forensicIntentRepository: { name: "forensicIntentRepository" },
            forensicService: { name: "forensicService" },
            timelineEventProofService: { name: "timelineEventProofService" },
            eventProofReconciliationService: { reconcileProof, markProofReconciliationFailed },
        } as const;

        registerSchedulerHandlers(deps as never);

        const calls = registerHandler.mock.calls as any[];
        const registeredTaskTypes = calls.map((call) => call[0]);
        expect(registeredTaskTypes).toContain(TaskType.RECONCILE_EVENT_PROOF);

        const reconcileRegistration = calls.find((call) => call[0] === TaskType.RECONCILE_EVENT_PROOF);
        expect(reconcileRegistration?.[1]).toEqual(expect.any(Function));
    });

    it("registers a reconciliation failure handler on the task manager", async () => {
        const { registerSchedulerHandlers } = await import("../registerSchedulerHandlers");
        const reconcileProof = mock(() => Promise.resolve({ status: "CONFIRMED" }));
        const markProofReconciliationFailed = mock(() => Promise.resolve({ status: "FAILED" }));

        const { taskManager } = await import("../../scheduler/instance");
        (taskManager as any).registerFailureHandler = registerFailureHandler;

        const deps = {
            forensicRepository: { name: "forensicRepository" },
            cryptoService: { name: "cryptoService" },
            passkeyRepository: { name: "passkeyRepository" },
            blockchainAnchor: { name: "blockchainAnchor" },
            forensicIntentRepository: { name: "forensicIntentRepository" },
            forensicService: { name: "forensicService" },
            timelineEventProofService: { name: "timelineEventProofService" },
            eventProofReconciliationService: { reconcileProof, markProofReconciliationFailed },
        } as const;

        registerSchedulerHandlers(deps as never);

        expect(registerFailureHandler).toHaveBeenCalledWith(
            TaskType.RECONCILE_EVENT_PROOF,
            expect.any(Function)
        );

        const [, failureHandler] = registerFailureHandler.mock.calls[0] as unknown as [
            TaskType,
            (payload: unknown, errorMessage: string) => Promise<void>
        ];

        await failureHandler(
            { itemId: "evt-1", version: 3, submittedTxHash: "0xabc" },
            "scheduler timeout"
        );

        expect(markProofReconciliationFailed).toHaveBeenCalledWith(
            "evt-1",
            3,
            "scheduler timeout",
            "0xabc"
        );
    });

    it("fails fast when the task manager does not expose registerFailureHandler", async () => {
        const { registerSchedulerHandlers } = await import("../registerSchedulerHandlers");
        const { taskManager } = await import("../../scheduler/instance");
        (taskManager as any).registerFailureHandler = undefined;

        const deps = {
            forensicRepository: { name: "forensicRepository" },
            cryptoService: { name: "cryptoService" },
            passkeyRepository: { name: "passkeyRepository" },
            blockchainAnchor: { name: "blockchainAnchor" },
            forensicIntentRepository: { name: "forensicIntentRepository" },
            forensicService: { name: "forensicService" },
            timelineEventProofService: { name: "timelineEventProofService" },
            eventProofReconciliationService: {
                reconcileProof: mock(() => Promise.resolve({ status: "CONFIRMED" })),
                markProofReconciliationFailed: mock(() => Promise.resolve({ status: "FAILED" })),
            },
        } as const;

        expect(() => registerSchedulerHandlers(deps as never)).toThrow(
            "Task manager must support registerFailureHandler for event proof reconciliation"
        );
    });

    it("fails fast when reconciliation failure persistence is not implemented", async () => {
        const { registerSchedulerHandlers } = await import("../registerSchedulerHandlers");

        const deps = {
            forensicRepository: { name: "forensicRepository" },
            cryptoService: { name: "cryptoService" },
            passkeyRepository: { name: "passkeyRepository" },
            blockchainAnchor: { name: "blockchainAnchor" },
            forensicIntentRepository: { name: "forensicIntentRepository" },
            forensicService: { name: "forensicService" },
            timelineEventProofService: { name: "timelineEventProofService" },
            eventProofReconciliationService: {
                reconcileProof: mock(() => Promise.resolve({ status: "CONFIRMED" })),
            },
        } as const;

        expect(() => registerSchedulerHandlers(deps as never)).toThrow(
            "Event proof reconciliation service must implement markProofReconciliationFailed"
        );
    });

    it("calls registerFailureHandler with the task manager bound as this", async () => {
        const { registerSchedulerHandlers } = await import("../registerSchedulerHandlers");
        const calls: Array<[TaskType, unknown]> = [];
        const thisSensitiveTaskManager = {
            registerHandler,
            failureHandlers: calls,
            registerFailureHandler(this: { failureHandlers: Array<[TaskType, unknown]> }, type: TaskType, handler: unknown) {
                this.failureHandlers.push([type, handler]);
            },
        };

        const { taskManager } = await import("../../scheduler/instance");
        Object.assign(taskManager as object, thisSensitiveTaskManager);

        const deps = {
            forensicRepository: { name: "forensicRepository" },
            cryptoService: { name: "cryptoService" },
            passkeyRepository: { name: "passkeyRepository" },
            blockchainAnchor: { name: "blockchainAnchor" },
            forensicIntentRepository: { name: "forensicIntentRepository" },
            forensicService: { name: "forensicService" },
            timelineEventProofService: { name: "timelineEventProofService" },
            eventProofReconciliationService: {
                reconcileProof: mock(() => Promise.resolve({ status: "CONFIRMED" })),
                markProofReconciliationFailed: mock(() => Promise.resolve({ status: "FAILED" })),
            },
        } as const;

        expect(() => registerSchedulerHandlers(deps as never)).not.toThrow();
        expect(calls).toContainEqual([TaskType.RECONCILE_EVENT_PROOF, expect.any(Function)]);
    });
});
