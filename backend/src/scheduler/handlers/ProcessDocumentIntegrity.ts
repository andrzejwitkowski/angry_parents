import { TaskManager } from '../TaskManager';
import { TaskType, ProcessDocumentIntegrityPayload, BlockchainPublishPayload } from '../types';
import { IForensicRepository } from '../../core/ports/IForensicRepository';
import { ICryptoService } from '../../core/ports/ICryptoService';
import { PasskeyRepository } from '../../core/ports/PasskeyRepository';
import { calculatePayloadHash } from '../utils/crypto';

export const createProcessDocumentIntegrityHandler = (
    forensicRepo: IForensicRepository,
    cryptoService: ICryptoService,
    passkeyRepo: PasskeyRepository,
    taskManager: TaskManager
) => async (payload: ProcessDocumentIntegrityPayload): Promise<void> => {
    console.log(`[ProcessDocumentIntegrity] Verifying document ${payload.documentIndex}...`);

    const doc = await forensicRepo.getDocumentByIndex(payload.documentIndex);
    if (!doc) {
        throw new Error(`Document not found: ${payload.documentIndex}`);
        // If not found, retrying might help if it's replication lag? 
        // If it never exists, it will eventually fail after maxRetries.
    }

    // 1. Canonicalize & Hash
    // We use the same logic as ForensicChain or our deterministic util.
    // The requirement says "Canonicalizes the document content (deterministic JSON), generates a SHA-256 hash".
    // ForensicDocument has toPayload().
    // We should verify if doc.hash matches calculated hash.

    // Note: ForensicDocument.toPayload() returns { index, content, prevHash, timestamp }.
    const payloadData = doc.toPayload();
    const calculatedHash = calculatePayloadHash(payloadData);

    if (calculatedHash !== doc.hash) {
        // This is a critical integrity failure. 
        // Stored hash does not match content.
        // Throwing error will cause retry, which keeps failing.
        console.error(`[ProcessDocumentIntegrity] HASH MISMATCH! Doc: ${doc.hash}, Calc: ${calculatedHash}`);
        throw new Error('Integrity Check Failed: Hash Mismatch');
    }

    // 2. Verify Signatures
    for (const sig of doc.signatures) {
        if (!sig.keyId) {
            console.warn(`[ProcessDocumentIntegrity] Signature missing keyId. Skipping verification for signer ${sig.signerId}`);
            continue;
        }

        // Convert keyId (Base64 string) to Uint8Array for lookup
        const credentialIdBuffer = Buffer.from(sig.keyId, 'base64url');
        const passkey = await passkeyRepo.findByCredentialID(credentialIdBuffer);

        if (!passkey) {
            console.warn(`[ProcessDocumentIntegrity] Passkey not found for keyId ${sig.keyId}. Cannot verify signature.`);
            throw new Error(`Passkey not found for keyId ${sig.keyId}`);
        }

        const publicKeyBase64 = Buffer.from(passkey.credentialPublicKey).toString('base64url');

        const isValid = await cryptoService.verifySignature(publicKeyBase64, doc.hash, sig.signature);
        if (!isValid) {
            throw new Error(`Invalid signature for signer ${sig.signerId} (KeyId: ${sig.keyId})`);
        }
    }

    console.log(`[ProcessDocumentIntegrity] Integrity Verified. Scheduling Blockchain Publish...`);

    // 3. Enqueue BLOCKCHAIN_PUBLISH
    await taskManager.schedule<BlockchainPublishPayload>(
        TaskType.BLOCKCHAIN_PUBLISH,
        {
            documentIndex: doc.index,
            documentHash: doc.hash,
            existingTxHash: payload.existingTxHash
        },
        {
            retryPolicy: { maxRetries: 5, initialDelayMinutes: 2 } // Longer backoff for blockchain
        }
    );
};
