import { TaskManager } from "./TaskManager";

// Standard polling interval, can be pushed to env
const DEFAULT_POLL_INTERVAL = 5000;

export const taskManager = new TaskManager(DEFAULT_POLL_INTERVAL);
