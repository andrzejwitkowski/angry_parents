export interface ObservabilityService {
    trackTimeout(taskType: string, taskId: string, metadata: any): void;
    log(level: 'info' | 'warn' | 'error', msg: string, context?: any): void;
}
