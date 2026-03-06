import { describe, it, expect } from "vitest";
import { mapErrorToStatus } from "../TimelineController";

describe("TimelineController - mapErrorToStatus", () => {
    it("should return 404 for missing timeline items", () => {
        const error = new Error("Timeline item with id 123 not found");
        expect(mapErrorToStatus(error)).toBe(404);
    });

    it("should return 500 for missing infrastructure entities (Child, Family)", () => {
        const childError = new Error("Child not found: child-1");
        const familyError = new Error("Family not found for child: child-1");

        expect(mapErrorToStatus(childError)).toBe(500);
        expect(mapErrorToStatus(familyError)).toBe(500);
    });

    it("should return 403 for unauthorized access", () => {
        expect(mapErrorToStatus(new Error("Unauthorized"))).toBe(403);
        expect(mapErrorToStatus(new Error("You can only modify your own items"))).toBe(403);
        expect(mapErrorToStatus(new Error("Child does not belong to this timeline item"))).toBe(403);
        expect(mapErrorToStatus(new Error("Forbidden: parent role required"))).toBe(403);
    });

    it("should return 400 for validation or encryption errors", () => {
        expect(mapErrorToStatus(new Error("Invalid date format"))).toBe(400);
        expect(mapErrorToStatus(new Error("Handover date cannot be in the past"))).toBe(400);
        expect(mapErrorToStatus(new Error("Medical visit must include a diagnosis"))).toBe(400);
        expect(mapErrorToStatus(new Error("Cannot encrypt: Missing parent public keys"))).toBe(400);
        expect(mapErrorToStatus(new Error("Both mom and dad must have registered RSA public keys"))).toBe(400);

        const zodError = { name: "ZodError" };
        expect(mapErrorToStatus(zodError)).toBe(400);
    });

    it("should return 500 for unknown errors", () => {
        expect(mapErrorToStatus(new Error("Database connection timed out"))).toBe(500);
        expect(mapErrorToStatus("Some random error string")).toBe(500);
    });
});
