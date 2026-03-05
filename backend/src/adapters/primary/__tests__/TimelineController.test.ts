import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTimelineController } from "../TimelineController";
import { TimelineServiceImpl } from "../../../application/TimelineService";
import { signJwt } from "../../../lib/jwt";

describe("TimelineController Ciphertext Selection", () => {
    let mockService: any;
    let controller: ReturnType<typeof createTimelineController>;
    let token: string;

    const MOCK_USER_ID = "user-123";
    const MOCK_MOM_ID = "mom-id";
    const MOCK_DAD_ID = "dad-id";

    beforeEach(async () => {
        mockService = {
            getItemsByDate: vi.fn(),
            getItemsByDateRange: vi.fn(),
            createItem: vi.fn(),
            updateItem: vi.fn(),
            deleteItem: vi.fn(),
        };

        controller = createTimelineController(mockService as any);

        // Generate a token for authentication
        token = await signJwt({
            userId: MOCK_USER_ID,
            role: "mom",
            familyId: "family-1",
            email: "mom@example.com"
        });
    });

    it("should flatten encryptedPayload and return only the ciphertext for the specific user", async () => {
        const mockItem = {
            id: "item-1",
            type: "NOTE",
            encryptedPayload: {
                [MOCK_USER_ID]: "ciphertext-for-user-123",
                "other-user": "ciphertext-for-other"
            }
        };

        mockService.getItemsByDate.mockResolvedValue([mockItem]);

        const response = await controller.handle(
            new Request(`http://localhost/api/calendar/2026-03-03/timeline`, {
                headers: {
                    Cookie: `token=${token}`
                }
            })
        );

        const data = await response.json();
        expect(data.items).toHaveLength(1);
        expect(data.items[0].ciphertext).toBe("ciphertext-for-user-123");
        expect(data.items[0].encryptedPayload).toBeUndefined();
        expect(data.items[0].id).toBe("item-1");
    });

    it("should return empty ciphertext if user ID is not in encryptedPayload (PRODUCTION)", async () => {
        // Force production mode for this test
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = "production";

        try {
            const mockItem = {
                id: "item-1",
                type: "NOTE",
                encryptedPayload: {
                    "different-user": "ciphertext"
                }
            };

            mockService.getItemsByDate.mockResolvedValue([mockItem]);

            const response = await controller.handle(
                new Request(`http://localhost/api/calendar/2026-03-03/timeline`, {
                    headers: {
                        Cookie: `token=${token}`
                    }
                })
            );

            const data = await response.json();
            expect(data.items[0].ciphertext).toBe("");
            expect(data.items[0].encryptedPayload).toBeUndefined();
        } finally {
            process.env.NODE_ENV = originalEnv;
        }
    });

    it("should return fallback ciphertext if user ID not in payload and NOT production (DEV FALLBACK)", async () => {
        const mockItem = {
            id: "item-1",
            type: "NOTE",
            encryptedPayload: {
                "different-user": "ciphertext-fallback"
            }
        };

        mockService.getItemsByDate.mockResolvedValue([mockItem]);

        const response = await controller.handle(
            new Request(`http://localhost/api/calendar/2026-03-03/timeline`, {
                headers: {
                    Cookie: `token=${token}`
                }
            })
        );

        const data = await response.json();
        expect(data.items[0].ciphertext).toBe("ciphertext-fallback");
        expect(data.items[0].encryptedPayload).toBeUndefined();
    });
});
