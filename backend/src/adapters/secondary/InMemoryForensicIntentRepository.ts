import type { ForensicIntentRecord, ForensicIntentRepository } from "../../core/ports/ForensicIntentRepository";

export class InMemoryForensicIntentRepository implements ForensicIntentRepository {
    private readonly intents = new Map<string, ForensicIntentRecord>();

    async save(intent: ForensicIntentRecord): Promise<void> {
        this.intents.set(intent.id, intent);
    }

    async findById(id: string): Promise<ForensicIntentRecord | null> {
        return this.intents.get(id) ?? null;
    }

    async markProcessing(id: string, timeoutMinutes = 5): Promise<boolean> {
        const intent = this.intents.get(id);
        if (!intent) return false;

        const now = new Date();
        const timeoutMs = timeoutMinutes * 60 * 1000;
        const isTimedOut = intent.status === "PROCESSING" &&
            intent.processingStartedAt &&
            (now.getTime() - intent.processingStartedAt.getTime() > timeoutMs);

        if (intent.status !== "PENDING" && !isTimedOut) return false;

        intent.status = "PROCESSING";
        intent.processingStartedAt = now;
        intent.retryCount += 1;
        this.intents.set(id, intent);
        return true;
    }

    async markCompleted(id: string): Promise<void> {
        const intent = this.intents.get(id);
        if (!intent) return;
        intent.status = "COMPLETED";
        intent.lastError = undefined;
        this.intents.set(id, intent);
    }

    async markRetry(id: string, errorMessage: string): Promise<void> {
        const intent = this.intents.get(id);
        if (!intent || intent.status === "COMPLETED") return;
        intent.status = "PENDING";
        intent.lastError = errorMessage;
        this.intents.set(id, intent);
    }
}
