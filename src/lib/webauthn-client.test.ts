import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

const startAuthenticationMock = mock(async () => ({ id: "assertion" }));
const startRegistrationMock = mock(async () => ({
  clientExtensionResults: { prf: { results: { first: new Uint8Array([1, 2, 3]).buffer } } }
}));

const authApiMock = {
  loginOptions: mock(async () => ({ challenge: "challenge", prfSaltBase64: "c2FsdA==" })),
  loginVerify: mock(async () => ({ verified: true, userId: "user-1", familyId: "fam-1" })),
  registerOptions: mock(async () => ({ challenge: "reg-challenge" })),
  registerVerify: mock(async () => ({ verified: true, userId: "user-1", familyId: "fam-1", role: "dad" })),
};

const savePrivateKeyMock = mock(async () => undefined);
const wrapPrivateKeyMock = mock(async () => "wrapped");
const unwrapPrivateKeyMock = mock(async () => ({}) as CryptoKey);
const deriveMasterKeyMock = mock(async () => ({}) as CryptoKey);
const generateRSAKeyPairMock = mock(async () => ({ publicKeyBase64: "pub", privateKey: {} as CryptoKey }));
const bytesToBase64Mock = mock(() => "salt-b64");

mock.module("@simplewebauthn/browser", () => ({
  startAuthentication: startAuthenticationMock,
  startRegistration: startRegistrationMock,
}));

mock.module("./api/auth", () => ({
  authApi: authApiMock,
}));

mock.module("./idb-crypto", () => ({
  savePrivateKey: savePrivateKeyMock,
}));

mock.module("./crypto-utils", () => ({
  generateRSAKeyPair: generateRSAKeyPairMock,
  deriveMasterKey: deriveMasterKeyMock,
  wrapPrivateKey: wrapPrivateKeyMock,
  unwrapPrivateKey: unwrapPrivateKeyMock,
  bytesToBase64: bytesToBase64Mock,
}));

import { isPrfSupported, checkHasPasskey, loginWithPasskey } from "./webauthn-client";

describe("isPrfSupported", () => {
  const originalPublicKeyCredential = (window as any).PublicKeyCredential;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    (window as any).PublicKeyCredential = originalPublicKeyCredential;
    globalThis.fetch = originalFetch;
    startAuthenticationMock.mockClear();
    authApiMock.loginOptions.mockClear();
    authApiMock.loginVerify.mockClear();
  });

  afterEach(() => {
    (window as any).PublicKeyCredential = originalPublicKeyCredential;
    globalThis.fetch = originalFetch;
  });

  it("returns true when PRF capability is reported directly", async () => {
    (window as any).PublicKeyCredential = {
      getClientCapabilities: async () => ({ prf: true }),
    };

    await expect(isPrfSupported()).resolves.toBe(true);
  });

  it("falls back to UVPA function result when getClientCapabilities throws", async () => {
    (window as any).PublicKeyCredential = {
      getClientCapabilities: async () => {
        throw new Error("not supported");
      },
      isUserVerifyingPlatformAuthenticatorAvailable: async () => false,
    };

    await expect(isPrfSupported()).resolves.toBe(false);
  });

  it("uses relative auth endpoints in passkey status check", async () => {
    const fetchMock = mock(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ hasPasskey: true })
    } as Response));

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(checkHasPasskey()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/webauthn/status", { credentials: "include" });
  });

  it("strips non-standard PRF salt field before startAuthentication", async () => {
    await expect(loginWithPasskey("test@example.com")).resolves.toBe(true);

    expect(authApiMock.loginOptions).toHaveBeenCalledWith({ email: "test@example.com" });
    const callArg = (startAuthenticationMock as any).mock.calls[0]?.[0] as any;
    expect(callArg).toBeDefined();
    expect(callArg.optionsJSON.challenge).toBe("challenge");
    expect(callArg.optionsJSON.prfSaltBase64).toBeUndefined();
  });
});
