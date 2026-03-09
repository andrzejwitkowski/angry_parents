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
  updatePublicKey: mock(async () => ({ success: true })),
  getMe: mock(async () => ({ user: { id: "user-1", email: "user-1@example.com", name: "User", gender: "dad" }, family: null })),
};

const savePrivateKeyMock = mock(async () => undefined);
const wrapPrivateKeyMock = mock(async () => "wrapped");
const unwrapPrivateKeyMock = mock(async () => ({}) as CryptoKey);
const deriveMasterKeyMock = mock(async () => ({}) as CryptoKey);
const generateRSAKeyPairMock = mock(async () => {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256"
    },
    true,
    ["encrypt", "decrypt"]
  );

  return { publicKeyBase64: "pub", privateKey: keyPair.privateKey };
});
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

import {
  __resetWebauthnClientDepsForTests,
  __setWebauthnClientDepsForTests,
  checkHasPasskey,
  isPrfSupported,
  loginWithPasskey,
  registerPasskeyForLoggedInUser,
} from "./webauthn-client";

describe("isPrfSupported", () => {
  const originalPublicKeyCredential = (window as any).PublicKeyCredential;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    (window as any).PublicKeyCredential = originalPublicKeyCredential;
    globalThis.fetch = originalFetch;
    startAuthenticationMock.mockClear();
    authApiMock.loginOptions.mockClear();
    authApiMock.loginVerify.mockClear();
    authApiMock.updatePublicKey.mockClear();
    authApiMock.getMe.mockClear();
    savePrivateKeyMock.mockClear();
    deriveMasterKeyMock.mockClear();
    wrapPrivateKeyMock.mockClear();
    unwrapPrivateKeyMock.mockClear();
    generateRSAKeyPairMock.mockClear();
    bytesToBase64Mock.mockClear();

    __setWebauthnClientDepsForTests({
      generateRSAKeyPair: generateRSAKeyPairMock as any,
      deriveMasterKey: deriveMasterKeyMock as any,
      wrapPrivateKey: wrapPrivateKeyMock as any,
      unwrapPrivateKey: unwrapPrivateKeyMock as any,
      bytesToBase64: bytesToBase64Mock as any,
    });
  });

  afterEach(() => {
    (window as any).PublicKeyCredential = originalPublicKeyCredential;
    globalThis.fetch = originalFetch;
    __resetWebauthnClientDepsForTests();
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

  it("fails closed when key material is returned but PRF results are missing", async () => {
    startAuthenticationMock.mockResolvedValueOnce({ id: "assertion", clientExtensionResults: {} } as any);
    authApiMock.loginVerify.mockResolvedValueOnce({
      verified: true,
      userId: "user-1",
      familyId: "fam-1",
      encryptedRsaPrivateKeyBase64: "wrapped-key",
      prfSaltBase64: "c2FsdA==",
    } as any);

    await expect(loginWithPasskey("test@example.com")).resolves.toBe(false);
    expect(deriveMasterKeyMock).not.toHaveBeenCalled();
    expect(savePrivateKeyMock).not.toHaveBeenCalled();
  });

  it("fails closed when key unwrap fails", async () => {
    startAuthenticationMock.mockResolvedValueOnce({
      id: "assertion",
      clientExtensionResults: { prf: { results: { first: new Uint8Array([1, 2, 3]).buffer } } }
    } as any);
    authApiMock.loginVerify.mockResolvedValueOnce({
      verified: true,
      userId: "user-1",
      familyId: "fam-1",
      encryptedRsaPrivateKeyBase64: "wrapped-key",
      prfSaltBase64: "c2FsdA==",
    } as any);
    unwrapPrivateKeyMock.mockRejectedValueOnce(new Error("unwrap failed"));

    await expect(loginWithPasskey("test@example.com")).resolves.toBe(false);
    expect(savePrivateKeyMock).not.toHaveBeenCalled();
  });

  it("returns true only after restoring and saving the private key", async () => {
    startAuthenticationMock.mockResolvedValueOnce({
      id: "assertion",
      clientExtensionResults: { prf: { results: { first: new Uint8Array([1, 2, 3]).buffer } } }
    } as any);
    authApiMock.loginVerify.mockResolvedValueOnce({
      verified: true,
      userId: "user-1",
      familyId: "fam-1",
      encryptedRsaPrivateKeyBase64: "wrapped-key",
      prfSaltBase64: "c2FsdA==",
    } as any);

    await expect(loginWithPasskey("test@example.com")).resolves.toBe(true);
    expect(deriveMasterKeyMock).toHaveBeenCalledTimes(1);
    expect(unwrapPrivateKeyMock).toHaveBeenCalledWith("wrapped-key", expect.anything(), false);
    expect(savePrivateKeyMock).toHaveBeenCalledWith("user-1", expect.anything());
  });

  it("provisions PRF-wrapped RSA key material for logged-in registration flow", async () => {
    const fetchMock = mock(async (input: string) => {
      if (input === "/api/auth/webauthn/register/options") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ challenge: "register-challenge" })
        } as Response;
      }

      if (input === "/api/auth/webauthn/register/verify") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ verified: true })
        } as Response;
      }

      throw new Error(`Unexpected fetch call: ${input}`);
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(registerPasskeyForLoggedInUser()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/webauthn/register/options", { credentials: "include" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/webauthn/register/verify",
      expect.objectContaining({
        method: "POST",
        credentials: "include"
      })
    );
    expect(authApiMock.updatePublicKey).toHaveBeenCalledTimes(1);
    expect(authApiMock.getMe).toHaveBeenCalledTimes(1);
    expect(savePrivateKeyMock).toHaveBeenCalledWith("user-1", expect.anything());
  });
});
