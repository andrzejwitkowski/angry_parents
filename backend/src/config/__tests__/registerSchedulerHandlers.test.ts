import { beforeEach, describe, expect, it, mock } from "bun:test";
import { TaskType } from "../../scheduler/types";

const registerHandler = mock(() => {});
const registerFailureHandlerMock = mock(() => {});

mock.module("../../scheduler/instance", () => ({
    taskManager: {
        registerHandler,
        registerFailureHandler: registerFailureHandlerMock,
    },
}));

describe("registerSchedulerHandlers", () => {
    beforeEach(() => {
        registerHandler.mockClear();
        registerFailureHandlerMock.mockClear();
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

        expect(registerFailureHandlerMock).toHaveBeenCalledWith(
            TaskType.RECONCILE_EVENT_PROOF,
            expect.any(Function)
        );
    });

    it("fails fast when the task manager cannot register reconciliation failure handlers", async () => {
        const { registerSchedulerHandlers } = await import("../registerSchedulerHandlers");
        const { taskManager } = await import("../../scheduler/instance");
        delete (taskManager as any).registerFailureHandler;

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

        (taskManager as any).registerFailureHandler = registerFailureHandlerMock;
    });
});
