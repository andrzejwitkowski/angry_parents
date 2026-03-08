import { Db, Collection } from "mongodb";
import { IForensicRepository } from "../../../../domain/forensic/ports/IForensicRepository";
import { ForensicDocument } from "../../../../domain/forensic/model/ForensicDocument";
import { SystemState } from "../../../../domain/forensic/model/SystemState";

export class MongoForensicRepository implements IForensicRepository {
    private docCollection: Collection<ForensicDocument<any>>;
    private stateCollection: Collection<SystemState>;

    constructor(db: Db) {
        this.docCollection = db.collection("forensic_documents");
        this.stateCollection = db.collection("system_state");
        this.ensureIndexes();
    }

    private ensureIndexes() {
        Promise.all([
            this.docCollection.createIndex({ index: 1 }, { unique: true }),
            this.docCollection.createIndex({ hash: 1 }, { unique: true })
        ]).catch(err => {
            if (err.name !== "MongoNotConnectedError" && !err.message.includes("client was closed") && !err.message.includes("topology was destroyed")) {
                console.error("Forensic index creation failed:", err);
            }
        });
    }

    async saveDocument<T>(doc: ForensicDocument<T>): Promise<void> {
        await this.docCollection.replaceOne(
            { index: doc.index },
            doc,
            { upsert: true }
        );
    }

    async getDocumentByIndex<T>(index: number): Promise<ForensicDocument<T> | null> {
        const doc = await this.docCollection.findOne({ index });
        if (!doc) return null;
        return new ForensicDocument(
            doc.index,
            doc.content,
            doc.prevHash,
            doc.timestamp,
            doc.status,
            doc.signatures,
            doc.hash,
            doc.blockchainTxId
        );
    }

    async getLastFinalizedDocument<T>(): Promise<ForensicDocument<T> | null> {
        const docs = await this.docCollection
            .find({ status: "FINALIZED" })
            .sort({ index: -1 })
            .limit(1)
            .toArray();

        return docs.length > 0 ? (docs[0] as ForensicDocument<T>) : null;
    }

    async getLastDocument<T>(): Promise<ForensicDocument<T> | null> {
        const docs = await this.docCollection
            .find({})
            .sort({ index: -1 })
            .limit(1)
            .toArray();

        return docs.length > 0 ? (docs[0] as ForensicDocument<T>) : null;
    }

    async getAllDocuments<T>(): Promise<ForensicDocument<T>[]> {
        return (await this.docCollection.find({}).sort({ index: 1 }).toArray()) as ForensicDocument<T>[];
    }

    async getSystemState(): Promise<SystemState | null> {
        return this.stateCollection.findOne({});
    }

    async saveSystemState(state: SystemState): Promise<void> {
        await this.stateCollection.replaceOne({}, state, { upsert: true });
    }
}
