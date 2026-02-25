import { describe, it, expect, beforeEach } from "bun:test";
import { createAdminController } from "../AdminController";
import { InMemoryRegistrationProcessRepository } from "../../secondary/__tests__/InMemoryRegistrationProcessRepository";
import { RegistrationStatus } from "../../../models/RegistrationProcess";

// Mock Family model
import { Family } from "../../../models/Family";
(Family as any).prototype.save = async function () { this._id = "mock_family_id"; return this; };

describe("AdminController", () => {
    let repo: InMemoryRegistrationProcessRepository;
    let app: any;

    beforeEach(() => {
        process.env.NODE_ENV = "development"; // Bypass RBAC for unit tests
        repo = new InMemoryRegistrationProcessRepository();
        app = createAdminController(repo as any);
    });

    it("should list all registrations", async () => {
        await repo.save({ _id: "1", parentAName: "Test", status: RegistrationStatus.FLOW_STARTED, timeline: [] });
        const res = await app.handle(new Request("http://localhost/api/admin/registrations"));
        const data = await res.json();
        expect(data).toHaveLength(1);
        expect(data[0].parentAName).toBe("Test");
    });

    it("should start a new registration process", async () => {
        const res = await app.handle(new Request("http://localhost/api/admin/registrations/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                parentName: "Alice",
                parentEmail: "alice@example.com",
                role: "Mom"
            })
        }));

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.parentAName).toBe("Alice");
        expect(data.status).toBe(RegistrationStatus.FLOW_STARTED);

        const all = await repo.findAll();
        expect(all).toHaveLength(1);
    });

    it("should aggregate logs from all processes", async () => {
        await repo.save({
            _id: "1",
            parentAName: "P1",
            timeline: [{ type: "T1", message: "M1", timestamp: new Date() }]
        });
        await repo.save({
            _id: "2",
            parentAName: "P2",
            timeline: [{ type: "T2", message: "M2", timestamp: new Date() }]
        });

        const res = await app.handle(new Request("http://localhost/api/admin/logs"));
        const text = await res.text();
        console.log("LOGS RESPONSE:", text);
        const data = JSON.parse(text);
        expect(data).toHaveLength(2);
        expect(data[0].parentAName).toBeDefined();
    });
});
