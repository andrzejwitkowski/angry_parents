import type { ITaskManager } from "../ports/TaskScheduler";
import type { TaskOutboxRepository } from "../ports/TaskOutboxRepository";

export class TaskOutboxDispatcher {
    private disabled = false;

    constructor(
        private readonly outboxRepository: TaskOutboxRepository & { markPending?(id: string): Promise<void> },
        private readonly taskManager: ITaskManager,
    ) {}

    setDisabled(disabled: boolean): void {
        this.disabled = disabled;
    }

    async dispatchNext(): Promise<boolean> {
        if (this.disabled) {
            return false;
        }

        const entry = await this.outboxRepository.claimNext();
        if (!entry) {
            return false;
        }

        try {
            await this.taskManager.schedule(entry.taskType as any, entry.payload as any, entry.retryPolicy ? { retryPolicy: entry.retryPolicy } : undefined);
        } catch (error) {
            if (this.outboxRepository.markPending) {
                await this.outboxRepository.markPending(entry.id);
            }
            throw error;
        }

        await this.outboxRepository.markDispatched(entry.id);
        return true;
    }
}
