import { CustodyEntry } from "./CustodyEntry";

export class ConflictService {
    static resolve(entries: CustodyEntry[]): CustodyEntry[] {
        // Sort by priority (asc) then creation/sequence?
        // We want higher priority to OVERWRITE lower priority.
        // "Last Write Wins" if priority equal.

        // Algorithm:
        // 1. Sort all input entries by priority ASC. 
        //    If priority equal, maintain relative order (assuming later in list = "Newer").
        // 2. Maintain a list of "Resolved Entries".
        // 3. For each candidate entry:
        //    Check overlap with existing Resolved Entries.
        //    If overlap:
        //      - Since candidate has >= priority (due to sorting), it "wins".
        //      - "Winning" means we might need to SPLIT or TRIM the existing entry.
        //      - Or if candidate completely covers existing, remove existing.

        let resolved: CustodyEntry[] = [];

        // Sort: Priority ASC.
        const sorted = [...entries].sort((a, b) => a.priority - b.priority);

        for (const candidate of sorted) {
            resolved = this.mergeEntry(resolved, candidate);
        }

        return resolved.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
    }

    private static mergeEntry(existingList: CustodyEntry[], candidate: CustodyEntry): CustodyEntry[] {
        const result: CustodyEntry[] = [];

        // We iterate through existing resolved items and see if 'candidate' affects them.
        // Candidate essentially "Carves out" its time from the timeline.
        // Whatever is left of the existing items stays.
        // The candidate itself is added at the end.

        const cStart = this.toMinutes(candidate.startTime);
        const cEnd = this.toMinutes(candidate.endTime);
        const cDate = candidate.date;

        for (const existing of existingList) {
            // If dates don't match, no overlap (assuming single-day entries for now).
            // CustodyEntry has 'date'. Assuming time is intra-day.
            if (existing.date !== cDate) {
                result.push(existing);
                continue;
            }

            const eStart = this.toMinutes(existing.startTime);
            const eEnd = this.toMinutes(existing.endTime);

            // Check Overlap
            // (NewStart < ExistingEnd) && (NewEnd > ExistingStart)
            const overlap = (cStart < eEnd) && (cEnd > eStart);

            if (!overlap) {
                result.push(existing);
                continue;
            }

            // Handle Overlap: Candidate effectively deletes/replaces this portion of Existing.
            // We might need to split Existing into parts (Pre-candidate, Post-candidate).

            // Part 1: Existing starts before Candidate starts
            if (eStart < cStart) {
                result.push({
                    ...existing,
                    id: crypto.randomUUID(), // New ID for split
                    endTime: candidate.startTime // Clip end
                });
            }

            // Part 2: Existing ends after Candidate ends
            if (eEnd > cEnd) {
                result.push({
                    ...existing,
                    id: crypto.randomUUID(), // New ID for split
                    startTime: candidate.endTime // Clip start
                });
            }
        }

        // Add candidate finally
        result.push(candidate);

        return result;
    }

    private static toMinutes(time: string): number {
        const [h, m] = time.split(':').map(Number);
        return h * 60 + m;
    }
}
