import mongoose from "mongoose";
import { Family, type IFamily } from "../../mongo/models/FamilyModel";
import { generateDevRSAKeyPair } from "../../security/BunCryptoService";

export const DEFAULT_DEV_DAD_ID = "mock-user-id-dev-test-stable";
export const DEFAULT_DEV_MOM_ID = "dummy-mom-id-stable";
export const MOCK_FAMILY_NAME = "Mock Family";
export const DEFAULT_DEMO_CHILD = {
    id: "mock-child-dev-stable",
    name: "Alex",
    icon: "user",
    color: "#3B82F6"
} as const;

let cachedDevKeyPair: { publicKey: string; privateKey: string } | null = null;

export async function getDevKeyPair() {
    if (!cachedDevKeyPair) {
        cachedDevKeyPair = await generateDevRSAKeyPair();
    }

    return cachedDevKeyPair;
}

type EnsureMockFamilyOptions = {
    dadUserId?: string;
    momUserId?: string;
    devPublicKey: string;
    includeDemoChild?: boolean;
};

export async function ensureMockFamily(options: EnsureMockFamilyOptions): Promise<IFamily> {
    const dadUserId = options.dadUserId ?? DEFAULT_DEV_DAD_ID;
    const momUserId = options.momUserId ?? DEFAULT_DEV_MOM_ID;
    const children = options.includeDemoChild ? [DEFAULT_DEMO_CHILD] : [];

    let family = await Family.findOne({ name: MOCK_FAMILY_NAME });

    if (!family) {
        family = new Family({
            _id: new mongoose.Types.ObjectId(),
            name: MOCK_FAMILY_NAME,
            parentIds: [dadUserId, momUserId],
            children,
            custodyPatterns: [],
            parentPublicKeys: [
                { parentId: dadUserId, role: "dad", rsaPublicKeyBase64: options.devPublicKey },
                { parentId: momUserId, role: "mom", rsaPublicKeyBase64: options.devPublicKey }
            ]
        });

        await family.save();
        return family;
    }

    family.name = MOCK_FAMILY_NAME;
    family.children = children;
    family.custodyPatterns = [];
    family.parentIds = [dadUserId, momUserId];
    family.parentPublicKeys = [
        { parentId: dadUserId, role: "dad", rsaPublicKeyBase64: options.devPublicKey },
        { parentId: momUserId, role: "mom", rsaPublicKeyBase64: options.devPublicKey }
    ];

    await family.save();
    return family;
}
