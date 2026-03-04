import { ObservabilityService } from "../../core/ports/ObservabilityService";

export class JsonLoggerObservability implements ObservabilityService {
    trackTimeout(taskType: string, taskId: string, metadata: any): void {
        this.log('error', `Task Timeout detected: ${taskType}`, {
            taskId,
            ...metadata,
            eventType: 'TASK_TIMEOUT'
        });
    }

    log(level: 'info' | 'warn' | 'error', msg: string, context?: any): void {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            msg,
            context
        };
        // Standard single-line JSON logging for ELK/Kibana
        console.log(JSON.stringify(entry));
    }
}
