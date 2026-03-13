import type { ReconcileEventProofPayload } from "../types";

export interface IEventProofReconciler {
    reconcileProof(itemId: string, version: number, submittedTxHash?: string): Promise<unknown>;
    markProofReconciliationFailed?(itemId: string, version: number, errorMessage: string, submittedTxHash?: string): Promise<unknown>;
}

export const createReconcileEventProofHandler = (
    eventProofReconciliationService: IEventProofReconciler
) => async (payload: ReconcileEventProofPayload): Promise<void> => {
    const result = await eventProofReconciliationService.reconcileProof(payload.itemId, payload.version, payload.submittedTxHash);
    if (
        result
        && typeof result === "object"
        && "status" in result
        && (result.status === "SUBMITTED" || result.status === "RECONCILING")
    ) {
        throw new Error(`Event proof receipt not available yet for item ${payload.itemId} version ${payload.version}`);
    }
};
