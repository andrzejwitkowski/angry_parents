import { describe, test, expect, beforeEach, jest, mock } from "bun:test";

const getPrivateKeyMock = jest.fn().mockResolvedValue({ type: "private" } as any);

mock.module("@/lib/idb-crypto", () => ({
    getPrivateKey: getPrivateKeyMock,
    clearPrivateKey: jest.fn().mockResolvedValue(undefined),
}));

mock.module("@/lib/api/auth", () => ({
    authApi: {
        getMe: jest.fn().mockResolvedValue({ user: { id: "user-1" } }),
    },
}));

describe("e2ee-session", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("starts in locked state and does not expose timeline private key before explicit unlock", async () => {
        const session = await import("./e2ee-session");

        session.setActiveE2eeUserId("user-1");
        session.markE2eeSessionLocked();

        const key = await session.getTimelinePrivateKey();

        expect(key).toBeNull();
        expect(getPrivateKeyMock).not.toHaveBeenCalled();
    });
});
