import { describe, expect, it, mock } from "bun:test";
import { createReconcileEventProofHandler } from "../handlers/ReconcileEventProof";

describe("ReconcileEventProof", () => {
    it("delegates reconciliation to the service for a single item version", async () => {
        const reconciliationService = {
            reconcileProof: mock(() => Promise.resolve({ status: "CONFIRMED" })),
        };

        const handler = createReconcileEventProofHandler(reconciliationService);

        await handler({ itemId: "item-123", version: 7 });

        expect(reconciliationService.reconcileProof).toHaveBeenCalledTimes(1);
        expect(reconciliationService.reconcileProof).toHaveBeenCalledWith("item-123", 7, undefined);
    });

    it("throws to trigger scheduler retry when the receipt is still unavailable", async () => {
        const reconciliationService = {
            reconcileProof: mock(() => Promise.resolve({
                status: "SUBMITTED",
                submittedTxHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
            })),
        };

        const handler = createReconcileEventProofHandler(reconciliationService);

        await expect(handler({ itemId: "item-123", version: 7 })).rejects.toThrow(
            "Event proof receipt not available yet for item item-123 version 7"
        );
    });

    it("also throws to retry when reconciliation is still in progress with a known submitted tx hash", async () => {
        const reconciliationService = {
            reconcileProof: mock(() => Promise.resolve({
                status: "RECONCILING",
                submittedTxHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
            })),
        };

        const handler = createReconcileEventProofHandler(reconciliationService);

        await expect(handler({
            itemId: "item-123",
            version: 7,
            submittedTxHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        })).rejects.toThrow(
            "Event proof receipt not available yet for item item-123 version 7"
        );
    });
});
