import { PasskeyRepository } from "../../../../domain/auth/ports/PasskeyRepository";
import { Passkey } from "../../../../domain/auth/model/Passkey";
import { PasskeyModel } from "../../models/PasskeyModel";

export class MongoPasskeyRepository implements PasskeyRepository {
    async save(passkey: Passkey): Promise<void> {
        const doc = {
            ...passkey,
            credentialID: Buffer.from(passkey.credentialID),
            credentialPublicKey: Buffer.from(passkey.credentialPublicKey)
        };
        await PasskeyModel.findOneAndUpdate(
            { credentialID: Buffer.from(passkey.credentialID) },
            doc,
            { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
        ).lean();
    }

    async findByUserId(userId: string): Promise<Passkey[]> {
        const docs = await PasskeyModel.find({ userId }).lean();
        return docs.map(doc => ({
            userId: doc.userId,
            webauthnUserId: doc.webauthnUserId,
            credentialID: new Uint8Array(doc.credentialID.buffer, doc.credentialID.byteOffset, doc.credentialID.byteLength),
            credentialPublicKey: new Uint8Array(doc.credentialPublicKey.buffer, doc.credentialPublicKey.byteOffset, doc.credentialPublicKey.byteLength),
            counter: doc.counter,
            transports: doc.transports,
            createdAt: doc.createdAt,
            name: doc.name
        }));
    }

    async findByCredentialID(credentialID: Uint8Array): Promise<Passkey | null> {
        const doc = await PasskeyModel.findOne({ credentialID: Buffer.from(credentialID) }).lean();
        if (!doc) return null;

        return {
            userId: doc.userId,
            webauthnUserId: doc.webauthnUserId,
            credentialID: new Uint8Array(doc.credentialID.buffer, doc.credentialID.byteOffset, doc.credentialID.byteLength),
            credentialPublicKey: new Uint8Array(doc.credentialPublicKey.buffer, doc.credentialPublicKey.byteOffset, doc.credentialPublicKey.byteLength),
            counter: doc.counter,
            transports: doc.transports,
            createdAt: doc.createdAt,
            name: doc.name
        };
    }

    async countByUserId(userId: string): Promise<number> {
        return PasskeyModel.countDocuments({ userId });
    }

    async updateCounter(credentialID: Uint8Array, newCounter: number): Promise<void> {
        await PasskeyModel.updateOne(
            { credentialID: Buffer.from(credentialID) },
            { $set: { counter: newCounter } }
        );
    }
}
