import { describe, it, expect } from "bun:test";

const BASE = "http://localhost:3000/api";
const CHILD_ID = "c1";

console.log("Verifying Rules API...");

async function verify() {
    // 1. Create Rule
    console.log("1. Creating Rule...");
    const config = {
        childId: CHILD_ID,
        startDate: "2025-03-01",
        endDate: "2025-03-14",
        type: "ALTERNATING_WEEKEND",
        startingParent: "DAD"
    };

    const createRes = await fetch(`${BASE}/rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
    });

    if (!createRes.ok) {
        console.error("Create Failed:", await createRes.text());
        process.exit(1);
    }

    const createData = await createRes.json();
    console.log("Created Rule ID:", createData.ruleId);

    // 2. List Rules
    console.log("2. Listing Rules...");
    const listRes = await fetch(`${BASE}/rules?childId=${CHILD_ID}`);
    const rules = await listRes.json();
    console.log("Found Rules:", rules.length);
    const found = rules.find((r: any) => r.id === createData.ruleId);
    if (!found) {
        console.error("Rule not found in list!");
        process.exit(1);
    }

    // 3. Delete Rule
    console.log("3. Deleting Rule...");
    const deleteRes = await fetch(`${BASE}/rules/${createData.ruleId}`, {
        method: "DELETE"
    });
    if (!deleteRes.ok) {
        console.error("Delete Failed:", await deleteRes.text());
        process.exit(1);
    }

    // 4. Verify Gone
    console.log("4. Verifying Gone...");
    const listRes2 = await fetch(`${BASE}/rules?childId=${CHILD_ID}`);
    const rules2 = await listRes2.json();
    const found2 = rules2.find((r: any) => r.id === createData.ruleId);
    if (found2) {
        console.error("Rule still exists!");
        process.exit(1);
    }

    console.log("SUCCESS: API Verification Passed.");
}

verify();
