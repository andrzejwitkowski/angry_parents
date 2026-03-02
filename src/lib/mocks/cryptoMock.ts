export const createMockSignature = () => ({
    signatureBase64: "mock_signature_base64_data",
    timestamp: new Date().toISOString(),
    keyId: "mock_yubikey_id"
});
