import { describe, expect, it, mock } from "bun:test";
import { createProcessForensicIntentHandler } from "./ProcessForensicIntent";
import type { ForensicIntentRepository } from "../../core/ports/ForensicIntentRepository";
import type { ForensicService } from "../../application/ForensicService";

describe("ProcessForensicIntent", () => {
    it("should bail out if markProcessing returns false (already claimed)", async () => {
        const mockRepo = {
            findById: mock(() => Promise.resolve({ id: "intent-1", status: "PENDING" })),
            markProcessing: mock(() => Promise.resolve(false)),
            markCompleted: mock(() => Promise.resolve()),
            markRetry: mock(() => Promise.resolve()),
        } as unknown as ForensicIntentRepository;

        const mockService = {
            createPendingDocument: mock(() => Promise.resolve()),
        } as unknown as ForensicService;

        const handler = createProcessForensicIntentHandler(mockRepo, mockService);
        await handler({ intentId: "intent-1" });

        expect(mockRepo.findById).toHaveBeenCalledWith("intent-1");
        expect(mockRepo.markProcessing).toHaveBeenCalledWith("intent-1");
        expect(mockService.createPendingDocument).not.toHaveBeenCalled();
        expect(mockRepo.markCompleted).not.toHaveBeenCalled();
    });

    it("should process and complete if markProcessing returns true", async () => {
        const mockRepo = {
            findById: mock(() => Promise.resolve({
                id: "intent-1",
                status: "PENDING",
                timelineItem: { id: "item-1" },
                signerPublicKey: "pub",
                signatureBase64: "sig",
                keyId: "kid",
                timestamp: "ts",
                signerId: "sid"
            })),
            markProcessing: mock(() => Promise.resolve(true)),
            markCompleted: mock(() => Promise.resolve()),
            markRetry: mock(() => Promise.resolve()),
        } as unknown as ForensicIntentRepository;

        const mockService = {
            createPendingDocument: mock(() => Promise.resolve()),
        } as unknown as ForensicService;

        const handler = createProcessForensicIntentHandler(mockRepo, mockService);
        await handler({ intentId: "intent-1" });

        expect(mockRepo.markProcessing).toHaveBeenCalledWith("intent-1");
        expect(mockService.createPendingDocument).toHaveBeenCalledWith(
            { id: "item-1" },
            "pub",
            "sig",
            "kid",
            "ts",
            "sid"
        );
        expect(mockRepo.markCompleted).toHaveBeenCalledWith("intent-1");
    });
});
