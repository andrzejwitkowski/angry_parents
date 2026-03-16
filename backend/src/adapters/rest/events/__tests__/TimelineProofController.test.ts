import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTimelineController } from "../TimelineController";
import { signJwt } from "../../../../lib/jwt";

describe("TimelineProofController", () => {
    let token: string;
    let controller: ReturnType<typeof createTimelineController>;
    let mockApiService: { getEventProof: ReturnType<typeof vi.fn>; publishEventProof: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
        token = await signJwt({
            userId: "user-123",
            role: "mom",
            familyId: "family-1",
            email: "mom@example.com"
        });

        mockApiService = {
            getEventProof: vi.fn(),
            publishEventProof: vi.fn()
        };

        controller = createTimelineController(mockApiService as any);
    });

    it("returns the latest anchored proof for an event", async () => {
        mockApiService.getEventProof.mockResolvedValue({
            status: "CONFIRMED",
            txHash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
            blockNumber: "201",
            hash: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
        });

        const response = await controller.handle(
            new Request("http://localhost/api/events/event-123/proof", {
                headers: {
                    Cookie: `token=${token}`
                }
            })
        );

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            status: "CONFIRMED",
            txHash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
            blockNumber: "201",
            hash: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
        });
        expect(mockApiService.getEventProof).toHaveBeenCalledWith("event-123", {
            id: "user-123",
            name: "mom@example.com",
            email: "mom@example.com",
            role: "mom",
            familyId: "family-1"
        });
    });

    it("returns 404 when the event does not exist", async () => {
        mockApiService.getEventProof.mockRejectedValue(new Error("Timeline item with id missing-event not found"));

        const response = await controller.handle(
            new Request("http://localhost/api/events/missing-event/proof", {
                headers: {
                    Cookie: `token=${token}`
                }
            })
        );

        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({
            error: "Timeline item with id missing-event not found"
        });
    });

    it("returns 404 when the event exists but has no proof yet", async () => {
        mockApiService.getEventProof.mockRejectedValue(new Error("Timeline item with id event-123 proof not found"));

        const response = await controller.handle(
            new Request("http://localhost/api/events/event-123/proof", {
                headers: {
                    Cookie: `token=${token}`
                }
            })
        );

        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({
            error: "Timeline item with id event-123 proof not found"
        });
    });

    it("returns deleted-event proof when an anchored deleted item is requested", async () => {
        mockApiService.getEventProof.mockResolvedValue({
            status: "CONFIRMED",
            txHash: "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
            blockNumber: "404",
            hash: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
        });

        const response = await controller.handle(
            new Request("http://localhost/api/events/deleted-event/proof", {
                headers: {
                    Cookie: `token=${token}`
                }
            })
        );

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            status: "CONFIRMED",
            txHash: "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
            blockNumber: "404",
            hash: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
        });
    });

    it("returns lifecycle status for an in-flight proof", async () => {
        mockApiService.getEventProof.mockResolvedValue({
            status: "SUBMITTED",
            hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            submittedTxHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        });

        const response = await controller.handle(
            new Request("http://localhost/api/events/event-123/proof", {
                headers: {
                    Cookie: `token=${token}`
                }
            })
        );

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            status: "SUBMITTED",
            hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            submittedTxHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        });
    });

    it("returns 404 when the event belongs to a different family scope", async () => {
        mockApiService.getEventProof.mockRejectedValue(new Error("Timeline item with id foreign-event not found"));

        const response = await controller.handle(
            new Request("http://localhost/api/events/foreign-event/proof", {
                headers: {
                    Cookie: `token=${token}`
                }
            })
        );

        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({
            error: "Timeline item with id foreign-event not found"
        });
    });

    it("returns 500 for infrastructure errors instead of masking them as not found", async () => {
        mockApiService.getEventProof.mockRejectedValue(new Error("Failed to resolve child ownership for timeline item: database offline"));

        const response = await controller.handle(
            new Request("http://localhost/api/events/event-123/proof", {
                headers: {
                    Cookie: `token=${token}`
                }
            })
        );

        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({
            error: "Failed to resolve child ownership for timeline item: database offline"
        });
    });

    it("allows authenticated proof recovery publishing through a normal route", async () => {
        mockApiService.publishEventProof.mockResolvedValue({
            txHash: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
            blockNumber: "123",
            hash: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
        });

        const response = await controller.handle(
            new Request("http://localhost/api/events/event-123/proof/publish", {
                method: "POST",
                headers: {
                    Cookie: `token=${token}`
                }
            })
        );

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            txHash: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
            blockNumber: "123",
            hash: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
        });
        expect(mockApiService.publishEventProof).toHaveBeenCalledWith("event-123", expect.objectContaining({ id: "user-123" }));
    });

    it("returns 403 when proof recovery is disabled", async () => {
        mockApiService.publishEventProof.mockRejectedValue(Object.assign(new Error("Proof recovery endpoint disabled"), { status: 403 }));

        const response = await controller.handle(
            new Request("http://localhost/api/events/event-123/proof/publish", {
                method: "POST",
                headers: {
                    Cookie: `token=${token}`
                }
            })
        );

        expect(response.status).toBe(403);
        expect(await response.json()).toEqual({
            error: "Proof recovery endpoint disabled"
        });
    });
});
