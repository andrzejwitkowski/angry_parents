import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { isPrfSupported } from "./webauthn-client";

describe("isPrfSupported", () => {
  const originalPublicKeyCredential = (window as any).PublicKeyCredential;

  beforeEach(() => {
    (window as any).PublicKeyCredential = originalPublicKeyCredential;
  });

  afterEach(() => {
    (window as any).PublicKeyCredential = originalPublicKeyCredential;
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
});
