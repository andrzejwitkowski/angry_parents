import { describe, it, expect, beforeEach, mock } from "bun:test";
import { createAdminController } from "../AdminController";
import { InMemoryRegistrationProcessRepository } from "../../secondary/__tests__/InMemoryRegistrationProcessRepository";
import { RegistrationStatus } from "../../../models/RegistrationProcess";

// Mock email library before importing anything that uses it if possible, 
// or use mock.module which is Bun's way to mock modules.
mock.module("../../../lib/email", () => ({
    sendParentAInitiationEmail: async () => ({
        link: "http://mock-link",
        html: "<html>Mock Email</html>"
    }),
    sendInvitationEmail: async () => ({
        link: "http://mock-link",
        html: "<html>Mock Email</html>"
    })
}));

// Mock models
import { Family } from "../../../models/Family";
import { Invitation } from "../../../models/Invitation";

(Family as any).prototype.save = async function () { this._id = "mock_family_id"; return this; };
(Invitation as any).prototype.save = async function () { this._id = "mock_invitation_id"; return this; };

describe("AdminController", () => {
    let repo: InMemoryRegistrationProcessRepository;
    let app: any;

    beforeEach(() => {
        process.env.NODE_ENV = "development"; // Bypass RBAC for unit tests
        repo = new InMemoryRegistrationProcessRepository();
        app = createAdminController(repo as any);
    });

    it("should list all registrations", async () => {
        await repo.save({ _id: "1", dadEmail: "test@example.com", status: RegistrationStatus.FLOW_STARTED, timeline: [] });
        const res = await app.handle(new Request("http://localhost/api/admin/registrations"));
        const data = await res.json();
        expect(data).toHaveLength(1);
        expect(data[0].dadEmail).toBe("test@example.com");
    });

    it("should start a new registration process", async () => {
        const res = await app.handle(new Request("http://localhost/api/admin/registrations/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                dadEmail: "dad@example.com",
                momEmail: "mom@example.com",
                familyName: "Test Family"
            })
        }));

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.dadEmail).toBe("dad@example.com");
        expect(data.status).toBe(RegistrationStatus.FLOW_STARTED);

        const all = await repo.findAll();
        expect(all).toHaveLength(1);
    });

    it("should aggregate logs from all processes", async () => {
        await repo.save({
            _id: "1",
            dadEmail: "P1",
            timeline: [{ type: "T1", message: "M1", timestamp: new Date() }]
        });
        await repo.save({
            _id: "2",
            dadEmail: "P2",
            timeline: [{ type: "T2", message: "M2", timestamp: new Date() }]
        });

        const res = await app.handle(new Request("http://localhost/api/admin/logs"));
        const text = await res.text();
        console.log("LOGS RESPONSE:", text);
        const data = JSON.parse(text);
        expect(data).toHaveLength(2);
        expect(data[0].processId).toBeDefined();
    });
});
