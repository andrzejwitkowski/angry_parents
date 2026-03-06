import { describe, it, expect, beforeEach, vi } from "vitest";
import { TimelineServiceImpl } from "../TimelineService";
import { InMemoryTimelineRepository } from "../../adapters/secondary/InMemoryTimelineRepository";
import { RealUuidProvider } from "../../adapters/secondary/RealUuidProvider";
import type { CreateTimelineItemDto } from "../../core/domain/TimelineItem";
import type { ICryptoService } from "../../core/ports/ICryptoService";
import type { DateProvider } from "../../core/ports/DateProvider";
import type { Model } from "mongoose";
import type { IFamily } from "../../models/Family";

// Mock Crypto Service
class MockCryptoService implements ICryptoService {
    async verifySignature(): Promise<boolean> { return true; }
    async getFingerprint(): Promise<string> { return "mock-fingerprint"; }
    async encryptRSA(plaintext: string, publicKey: string): Promise<string> {
        return `encrypted-${plaintext.substring(0, 10)}`;
    }
}

describe("TimelineService - Timezone Regression", () => {
    let service: TimelineServiceImpl;
    let repository: InMemoryTimelineRepository;
    let mockDateProvider: DateProvider;

    beforeEach(() => {
        repository = new InMemoryTimelineRepository();

        const mockFamilyModel = {
            findById: vi.fn().mockResolvedValue({
                parentPublicKeys: [
                    { parentId: "mom-1", role: "mom", rsaPublicKeyBase64: "mom-pub-key" },
                    { parentId: "dad-1", role: "dad", rsaPublicKeyBase64: "dad-pub-key" }
                ]
            })
        };

        const mockChildRepository = {
            findById: vi.fn().mockResolvedValue({
                id: "child-1",
                familyId: "family-1"
            })
        };

        mockDateProvider = {
            getNow: vi.fn(),
            getIsoString: vi.fn().mockReturnValue(new Date().toISOString())
        };

        service = new TimelineServiceImpl(
            repository,
            mockDateProvider,
            new RealUuidProvider(),
            new MockCryptoService(),
            mockFamilyModel as unknown as Model<IFamily>,
            mockChildRepository as any,
            { save: vi.fn() } as any,
            { schedule: vi.fn() } as any
        );
    });

    /**
     * This test ensures that even if "now" is late in the day (e.g. 23:59),
     * a handover for "today" (same-day) is correctly accepted.
     * The bug was that new Date("YYYY-MM-DD") could produce a UTC midnight 
     * which in many timezones is technically "in the past" relative to local midnight.
     */
    it("should accept handover for today even if it is late in the evening", async () => {
        // Mock "now" to be late in the evening of 2026-03-06
        const mockedNow = new Date(2026, 2, 6, 23, 59, 59); // March 6, 2026, 23:59:59 (Local)
        (mockDateProvider.getNow as any).mockReturnValue(new Date(mockedNow));

        const dto = {
            type: "HANDOVER",
            date: "2026-03-06", // Same day
            createdBy: "user-1",
            createdByName: "User 1",
            childId: "child-1",
            encryption: "ENCRYPTED",
            encryptedPayload: { "user-1": "encrypted-handover" },
        } as any;

        const result = await service.createItem({
            ...dto,
            signatureBase64: "sig",
            timestamp: mockedNow.toISOString(),
            keyId: "key1"
        } as any);

        expect(result).toBeDefined();
        expect(result.type).toBe("HANDOVER");
    });

    it("should still reject handover for yesterday", async () => {
        const mockedNow = new Date(2026, 2, 6, 12, 0, 0); // March 6, 2026, Noon
        (mockDateProvider.getNow as any).mockReturnValue(new Date(mockedNow));

        const dto = {
            type: "HANDOVER",
            date: "2026-03-05", // Yesterday
            createdBy: "user-1",
            createdByName: "User 1",
            childId: "child-1",
            encryption: "ENCRYPTED",
            encryptedPayload: { "user-1": "encrypted-handover" },
        } as any;

        await expect(service.createItem({
            ...dto,
            signatureBase64: "sig",
            timestamp: mockedNow.toISOString(),
            keyId: "key1"
        } as any)).rejects.toThrow("Handover date cannot be in the past");
    });
});
