
import { Db, Collection } from "mongodb";
import { IForensicRepository } from "../../core/ports/IForensicRepository";
import { ForensicDocument } from "../../core/domain/forensic/ForensicDocument";
import { SystemState } from "../../core/domain/forensic/SystemState";

export class MongoForensicRepository implements IForensicRepository {
    private docCollection: Collection<ForensicDocument<any>>;
    private stateCollection: Collection<SystemState>;

    constructor(db: Db) {
        this.docCollection = db.collection("forensic_documents");
        this.stateCollection = db.collection("system_state");
        this.ensureIndexes();
    }

    private async ensureIndexes() {
        await this.docCollection.createIndex({ index: 1 }, { unique: true });
        await this.docCollection.createIndex({ hash: 1 }, { unique: true });
    }

    async saveDocument<T>(doc: ForensicDocument<T>): Promise<void> {
        // using ReplaceOne with upsert to handle updates (e.g. adding signature B)
        await this.docCollection.replaceOne(
            { index: doc.index },
            doc,
            { upsert: true }
        );
    }

    async getDocumentByIndex<T>(index: number): Promise<ForensicDocument<T> | null> {
        const doc = await this.docCollection.findOne({ index });
        return doc as ForensicDocument<T> | null;
    }

    async getLastFinalizedDocument<T>(): Promise<ForensicDocument<T> | null> {
        const docs = await this.docCollection
            .find({ status: "FINALIZED" })
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
        // Singleton state
        await this.stateCollection.replaceOne({}, state, { upsert: true });
    }
}
