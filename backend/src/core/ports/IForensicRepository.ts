
import { ForensicDocument } from "../domain/forensic/ForensicDocument";
import { SystemState } from "../domain/forensic/SystemState";

export interface IForensicRepository {
    saveDocument<T>(doc: ForensicDocument<T>): Promise<void>;
    getDocumentByIndex<T>(index: number): Promise<ForensicDocument<T> | null>;
    getLastFinalizedDocument<T>(): Promise<ForensicDocument<T> | null>;
    getAllDocuments<T>(): Promise<ForensicDocument<T>[]>;

    getSystemState(): Promise<SystemState | null>;
    saveSystemState(state: SystemState): Promise<void>;
}
