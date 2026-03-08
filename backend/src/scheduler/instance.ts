import { TaskManager } from "./TaskManager";
import { JsonLoggerObservability } from "../adapters/observability/JsonLoggerObservability";

// Standard polling interval, can be pushed to env
const DEFAULT_POLL_INTERVAL = parseInt(process.env.SCHEDULER_POLL_INTERVAL || "5000");

// Default to JSON logger for ELK/Kibana compatibility
const observability = new JsonLoggerObservability();

export const taskManager = new TaskManager(observability, DEFAULT_POLL_INTERVAL);
