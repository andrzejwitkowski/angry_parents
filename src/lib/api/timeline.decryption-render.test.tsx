import { render, screen, act } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, it, expect, jest, mock, beforeEach } from "bun:test";
import i18n from "@/i18n";
import type { EncryptedTimelineItem } from "@/types/timeline.types";
import { TimelineItemFactory } from "@/components/calendar/day-details/components/TimelineItemFactory";
import { SecurityProvider } from "@/context/SecurityContext";

mock.module("@/lib/crypto-utils", () => ({
    importPrivateKey: jest.fn(),
    decryptRSA: jest.fn(),
}));

mock.module("@/lib/e2ee-session", () => ({
    getTimelinePrivateKey: jest.fn(),
    getActiveE2eeUserId: jest.fn(),
    clearTimelinePrivateKeyCache: jest.fn(),
    hasStoredPrivateKey: jest.fn().mockResolvedValue(true),
    clearActivePrivateKey: jest.fn().mockResolvedValue(undefined),
    markE2eeSessionLocked: jest.fn(),
    markE2eeSessionUnlocked: jest.fn(),
    setActiveE2eeUserId: jest.fn(),
}));

mock.module("@/lib/api/auth", () => ({
    authApi: {
        getMe: jest.fn(),
    },
}));

import { timelineApi } from "./timeline";
import { decryptRSA } from "@/lib/crypto-utils";
import { authApi } from "@/lib/api/auth";
import { getTimelinePrivateKey, getActiveE2eeUserId, clearTimelinePrivateKeyCache, markE2eeSessionLocked } from "@/lib/e2ee-session";

const baseEncryptedMedical: EncryptedTimelineItem = {
    id: "enc-medical-1",
    type: "MEDICAL_VISIT",
    date: "2026-03-05",
    createdAt: "2026-03-05T12:00:00.000Z",
    createdBy: "user-creator",
    createdByName: "Creator",
    auditTrail: [],
    isDeleted: false,
    childIds: ["child-1"],
    encryption: "ENCRYPTED",
    encryptedPayload: {},
};

describe("timelineApi decryption rendering", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
        (global.fetch as jest.Mock) = jest.fn();
        (getTimelinePrivateKey as jest.Mock).mockResolvedValue({} as CryptoKey);
        (getActiveE2eeUserId as jest.Mock).mockResolvedValue("69a9888db691c30ad45e5dc7");
    });

    it("renders decrypted MEDICAL_VISIT fields in DOM when decryption succeeds", async () => {
        (authApi.getMe as jest.Mock).mockResolvedValue({
            user: { id: "69a9888db691c30ad45e5dc7", email: "x@y.com", name: "Mom", gender: "mom" },
            family: null,
        });
        (decryptRSA as jest.Mock).mockResolvedValue(JSON.stringify({
            doctor: "Dr. House",
            diagnosis: "Lupus ruled out",
            recommendations: "Rest",
            attachments: [],
        }));

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            status: 200,
            statusText: "OK",
            json: async () => ({
                items: [{
                    ...baseEncryptedMedical,
                    encryptedPayload: {
                        "69a9888db691c30ad45e5dc7": "cipher-for-user",
                    },
                }],
            }),
        });

        const items = await timelineApi.getByDate("2026-03-05");

        await act(async () => {
            render(
                <SecurityProvider>
                    <I18nextProvider i18n={i18n}>
                        <TimelineItemFactory item={items[0]} user={null} />
                    </I18nextProvider>
                </SecurityProvider>
            );
        });

        expect(screen.getByText("Dr. House")).toBeInTheDocument();
        expect(screen.getByText("Lupus ruled out")).toBeInTheDocument();
    });

    it("renders encrypted placeholder when decryption fails", async () => {
        (getTimelinePrivateKey as jest.Mock).mockResolvedValue({} as CryptoKey);
        (decryptRSA as jest.Mock).mockRejectedValue(new Error("bad decrypt"));

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            status: 200,
            statusText: "OK",
            json: async () => ({
                items: [{
                    ...baseEncryptedMedical,
                    ciphertext: "ciphertext-from-backend",
                }],
            }),
        });

        const items = await timelineApi.getByDate("2026-03-05");

        await act(async () => {
            render(
                <SecurityProvider>
                    <I18nextProvider i18n={i18n}>
                        <TimelineItemFactory item={items[0]} user={null} />
                    </I18nextProvider>
                </SecurityProvider>
            );
        });

        expect(screen.getByText("Encrypted Entry")).toBeInTheDocument();
        expect(screen.queryByText("Dr. House")).toBeNull();
    });

    it("does not use legacy localStorage private key for decryption", async () => {
        localStorage.setItem("zk_private_key", "legacy-private-key");
        (getTimelinePrivateKey as jest.Mock).mockResolvedValue(null);

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            status: 200,
            statusText: "OK",
            json: async () => ({
                items: [{
                    ...baseEncryptedMedical,
                    ciphertext: "ciphertext-from-backend",
                }],
            }),
        });

        const items = await timelineApi.getByDate("2026-03-05");

        expect(getTimelinePrivateKey).toHaveBeenCalled();
        expect(decryptRSA).not.toHaveBeenCalled();
        expect(items[0].encryption).toBe("ENCRYPTED");
    });

    it("exposes cache clearing for session lock cleanup", async () => {
        timelineApi.clearDecryptionCaches();

        expect(clearTimelinePrivateKeyCache).toHaveBeenCalledTimes(1);
    });

});
