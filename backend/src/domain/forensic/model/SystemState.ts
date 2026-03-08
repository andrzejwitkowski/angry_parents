
import { z } from "zod";

export const SystemStateSchema = z.object({
    totalDocs: z.number().int().min(0),
    lastFinalHash: z.string(),
    updatedAt: z.string().datetime(),
    signatures: z.array(z.any()) // Validation of signatures happens in service/logic
});

export type SystemState = z.infer<typeof SystemStateSchema>;
