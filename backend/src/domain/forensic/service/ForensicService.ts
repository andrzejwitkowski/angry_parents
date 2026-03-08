import { IForensicRepository } from "../ports/IForensicRepository";
import { IBlockchainAnchor } from "../../shared/ports/IBlockchainAnchor";
import { ICryptoService } from "../../shared/ports/ICryptoService";
import { ForensicDocument, Signature } from "../model/ForensicDocument";
import { ForensicChain } from "../model/ForensicChain";
import { SystemState } from "../model/SystemState";
import { ITaskManager, TaskType } from "../../shared/ports/TaskScheduler";
import { ProcessDocumentIntegrityPayload } from "../../../scheduler/types";

export class ForensicService {
    constructor(
        private repository: IForensicRepository,
        private blockchain: IBlockchainAnchor,
        private crypto: ICryptoService,
        private taskManager: ITaskManager
    ) { }

    async initialize(adminPublicKey: string) {
        const allowedFingerprint = process.env.ALLOWED_ADMIN_FINGERPRINT;
        if (!allowedFingerprint) {
            throw new Error("ALLOWED_ADMIN_FINGERPRINT env var not set");
        }

        const fingerprint = await this.crypto.getFingerprint(adminPublicKey);
        if (fingerprint !== allowedFingerprint) {
            throw new Error("SECURITY ALERT: Admin Public Key does not match allowed fingerprint!");
        }

        // In a real system, we might store this verified key in memory or DB as "Active Admin Key"
        console.log("System initialized. Admin key verified.");
    }

    async createPendingDocument<T>(
        content: T,
        userPublicKey: string,
        signatureBase64: string,
        keyId: string,
        timestamp: string,
        signerId: string,
        index?: number,
        prevHash?: string
    ): Promise<ForensicDocument<T>> {
        // 1. Determine index and prevHash
        let targetIndex = index;
        let targetPrevHash = prevHash;

        if (targetIndex === undefined || targetPrevHash === undefined) {
            const lastDoc = await this.repository.getLastDocument();
            if (targetIndex === undefined) targetIndex = lastDoc ? lastDoc.index + 1 : 0;
            if (targetPrevHash === undefined) targetPrevHash = lastDoc ? lastDoc.hash : "GENESIS_HASH";
        }

        if (targetIndex === undefined || targetPrevHash === undefined) {
            throw new Error("Unable to resolve forensic document position");
        }

        const resolvedIndex = targetIndex;
        const resolvedPrevHash = targetPrevHash;

        // 2. Create Payload Candidate
        const tempDoc = new ForensicDocument(resolvedIndex, content, resolvedPrevHash, timestamp);

        // 3. Calculate Hash
        const payload = tempDoc.toPayload();
        const hash = await ForensicChain.calculateHash(payload);
        tempDoc.hash = hash;

        if (process.env.NODE_ENV === "production") {
            const isValid = await this.crypto.verifySignature(userPublicKey, hash, signatureBase64);
            if (!isValid) {
                throw new Error("Invalid signature for forensic document");
            }
        }

        // IDEMPOTENCY CHECK: Check if this exact document already exists
        const existingAtIndex = await this.repository.getDocumentByIndex<T>(resolvedIndex);
        if (existingAtIndex) {
            if (existingAtIndex.hash === hash) {
                console.log(`[Forensic] Pending Document already exists at index ${resolvedIndex} with same hash. Idempotent return.`);
                // Ensure signature is present (if somehow saved without it?)
                if (!existingAtIndex.signatures.some(s => s.signature === signatureBase64)) {
                    // Should not happen if we save atomically, but good for robustness
                    existingAtIndex.signatures.push({
                        signerId: signerId,
                        signature: signatureBase64,
                        timestamp: new Date().toISOString(),
                        keyId: keyId
                    });
                    await this.repository.saveDocument(existingAtIndex);
                }
                return existingAtIndex;
            } else {
                throw new Error(`Conflict: Index ${resolvedIndex} is already occupied by a different document (Hash mismatch). Fetch latest head and retry.`);
            }
        }

        // 4. Add Signature A (WITHOUT User Verification - Offloaded to Worker)
        // We trust the structure for now, integrity check will validate signature later.
        const sigA: Signature = {
            signerId: signerId,
            signature: signatureBase64,
            timestamp: new Date().toISOString(),
            keyId: keyId
        };
        tempDoc.signatures.push(sigA);
        tempDoc.status = "PENDING";

        // 5. Save
        await this.repository.saveDocument(tempDoc);
        console.log(`[Forensic] Pending Document created at index ${resolvedIndex}.`);

        // 6. Schedule Integrity Check (Async)
        await this.taskManager.schedule<ProcessDocumentIntegrityPayload>(
            TaskType.PROCESS_DOCUMENT_INTEGRITY,
            { documentIndex: resolvedIndex },
            {
                retryPolicy: { maxRetries: 3, initialDelayMinutes: 0 } // Immediate retry if busy
            }
        );
        console.log(`[Forensic] Scheduled Integrity Check for index ${resolvedIndex}.`);

        return tempDoc;
    }

    async finalizeDocument<T>(
        index: number,
        adminPublicKey: string,
        signatureBase64: string,
        keyId: string,
        signerId: string,
        existingTxHash?: string
    ): Promise<ForensicDocument<T>> {
        // 1. Get Document
        const doc = await this.repository.getDocumentByIndex<T>(index);
        if (!doc) throw new Error("Document not found");

        // IDEMPOTENCY CHECK
        if (doc.status === "FINALIZED") {
            await this.ensureSystemStateConsistency(doc.index, doc.hash);
            return doc;
        }

        // 2. Admin Signature (Idempotent Step)
        const existingSig = doc.signatures.find(s => s.signerId === signerId);
        if (!existingSig) {
            // Add & SAVE (Checkpoint 1)
            // NO Verification here (Async)
            doc.signatures.push({
                signerId: signerId,
                signature: signatureBase64,
                timestamp: new Date().toISOString(),
                keyId: keyId
            });
            await this.repository.saveDocument(doc);
            console.log(`[Forensic] Index ${index}: Admin Signature saved.`);
        } else {
            console.log(`[Forensic] Index ${index}: Admin Signature already present. Skipping.`);
        }

        // 3. Schedule Processing (Integrity -> Blockchain)
        // We schedule Integrity check again to verify the NEW signature (Admin's)
        // And then it will trigger Blockchain Publish if valid.
        await this.taskManager.schedule<ProcessDocumentIntegrityPayload>(
            TaskType.PROCESS_DOCUMENT_INTEGRITY,
            {
                documentIndex: index,
                existingTxHash: existingTxHash
            }, // Pass existingTxHash if provided for recovery
            {
                retryPolicy: { maxRetries: 3, initialDelayMinutes: 0 }
            }
        );
        console.log(`[Forensic] Scheduled Finalization (Integrity Check) for index ${index}.`);

        // We do NOT wait for blockchain here. We return the document with the new signature.
        return doc;
    }

    private async ensureSystemStateConsistency(index: number, hash: string) {
        const state = await this.repository.getSystemState();
        // If state is missing or behind, update it
        // Note: This logic assumes sequential processing.
        if (!state || state.totalDocs <= index) {
            const newState: SystemState = {
                totalDocs: index + 1,
                lastFinalHash: hash,
                updatedAt: new Date().toISOString(),
                signatures: state?.signatures || []
            };
            await this.repository.saveSystemState(newState);
            console.log(`[Forensic] System State updated to count ${index + 1}.`);
        }
    }
}
