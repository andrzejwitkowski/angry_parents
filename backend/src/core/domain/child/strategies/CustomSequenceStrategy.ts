import { CustodyEntry } from "../CustodyEntry";
import { CustodyPatternConfig } from "../CustodyPatternConfig";
import { CustodyStrategy } from "./CustodyStrategy";
import { TimeUtils } from "../TimeUtils";

export class CustomSequenceStrategy implements CustodyStrategy {
    generate(config: CustodyPatternConfig): CustodyEntry[] {
        const entries: CustodyEntry[] = [];
        const dates = TimeUtils.getDatesInRange(config.startDate, config.endDate);
        const sequence = config.sequence || [1, 1]; // Default 1-1 if missing

        // Cycle length is sum of sequence array.
        // e.g. [2, 2, 3] -> 7 days (Weekly 2-2-3? No, 2-2-3 repeats every 2 weeks usually 2-2-3-2-2-3)
        // Actually 2-2-3 is usually defined as [2, 2, 3, 2, 2, 3] for full rotation equality?
        // Or if sequence is [1, 13] -> P1(1), P2(13). 

        const cycleLength = sequence.reduce((sum, val) => sum + val, 0);
        const p1 = config.startingParent;
        const p2 = p1 === 'MOM' ? 'DAD' : 'MOM';

        dates.forEach(date => {
            const start = new Date(config.startDate);
            const current = new Date(date);
            const diffTime = Math.abs(current.getTime() - start.getTime());
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            const cycleDay = diffDays % cycleLength;

            // Find which block we are in
            let currentDayInCycle = 0;
            let owner: 'MOM' | 'DAD' = p1;

            for (let i = 0; i < sequence.length; i++) {
                const blockSize = sequence[i];
                // Parent flips every block? 
                // e.g [2, 2, 3]. Block 0 (2 days) -> P1. Block 1 (2 days) -> P2. Block 2 (3 days) -> P1.
                // Next cycle: Block 0 (2 days) -> P1... 
                // WAIT. If 2-2-3 is odd number of blocks (3), then next cycle starts with P2? 
                // [2(A), 2(B), 3(A)] -> Next 14 days: [2(B), 2(A), 3(B)] ?
                // Yes, if we just toggle parent index.

                // "Every Other Tuesday": [1, 13]. 
                // Day 0: P1. Day 1-13: P2.
                // Next cycle Day 0: P1.

                // To support both (stable vs alternating cycles), we need to know if the sequence itself forces alternation.
                // If sum(sequence) % 2 != 0? No.
                // Simple approach: Toggle parent for each block index.
                // If total blocks is ODD, the cycle naturally alternates starting parents next time?
                // [2, 2, 3] -> 3 blocks.
                // Cycle 1: Block 0(P1), Block 1(P2), Block 2(P1). End.
                // Cycle 2: Block 0(P1)... No, standard modulo arithmetic resets.

                // For 2-2-3 (Alternating), we usually define sequence as full 14 days: [2, 2, 3, 2, 2, 3].

                // For "Every Other Tuesday": [1, 13].
                // Cycle 1: Block 0(P1), Block 1(P2).
                // Cycle 2: Block 0(P1)... 
                // This works perfectly for recurring same-day if cycle is 14 days.

                if (cycleDay < currentDayInCycle + blockSize) {
                    // Found our block
                    const isEvenBlock = i % 2 === 0;
                    owner = isEvenBlock ? p1 : p2;
                    break;
                }
                currentDayInCycle += blockSize;
            }

            // We assume full days for Custom Sequence for now.
            // Split days would require more complex config (start/end times per block?)
            entries.push({
                id: crypto.randomUUID(),
                childId: config.childId,
                date: date,
                startTime: "00:00",
                endTime: "23:59",
                assignedTo: owner,
                isRecurring: true,
                priority: 0
            });
        });

        return entries;
    }
}
