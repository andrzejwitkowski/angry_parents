
import { describe, it, expect } from "bun:test";
import { ForensicDocument } from "../src/domain/forensic/model/ForensicDocument";

// 1. Defining different Content Types
interface TimeLineEntry {
    id: string;
    type: "NOTE" | "MEDICAL";
    details: string;
}

interface OfficialDocument {
    docId: string;
    title: string;
    pdfUrl: string;
    notaryId: string;
}

describe("Forensic System Modularity", () => {
    it("Supports TimeLineEntry items", () => {
        const entry: TimeLineEntry = {
            id: "123",
            type: "NOTE",
            details: "Child pickup at 5 PM"
        };

        const forensicDoc = new ForensicDocument<TimeLineEntry>(
            1,
            entry,
            "prev_hash",
            new Date().toISOString()
        );

        expect(forensicDoc.content.type).toBe("NOTE");
        expect(forensicDoc.content.details).toContain("Child pickup");
    });

    it("Supports OfficialDocument items", () => {
        const entry: OfficialDocument = {
            docId: "DOC_001",
            title: "Court Order 2024",
            pdfUrl: "https://s3...",
            notaryId: "NOTARY_X"
        };

        const forensicDoc = new ForensicDocument<OfficialDocument>(
            2,
            entry,
            "prev_hash_2",
            new Date().toISOString()
        );

        expect(forensicDoc.content.notaryId).toBe("NOTARY_X");

        // Ensure toPayload preserves the structure correctly
        const payload = forensicDoc.toPayload();
        expect(payload.content.title).toBe("Court Order 2024");
    });
});
