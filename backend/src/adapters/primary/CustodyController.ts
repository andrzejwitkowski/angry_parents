import { Elysia, t } from "elysia";
import { CustodyGenerator } from "../../application/CustodyGenerator";
import { CustodyPatternConfig } from "../../core/domain/child/CustodyPatternConfig";
import { PatternType } from "../../core/domain/child/CustodyEntry";

export const custodyController = new Elysia({ prefix: "/api/custody" })
    .post("/preview", ({ body, set }) => {
        try {
            const config = body as unknown as CustodyPatternConfig;
            const generator = new CustodyGenerator();

            // Generate entries based on config
            const entries = generator.generate(config);

            return entries;
        } catch (e) {
            console.error("Error generating custody preview:", e);
            set.status = 500;
            return { error: "Failed to generate custody schedule" };
        }
    }, {
        body: t.Object({
            childId: t.String(),
            startDate: t.String(),
            endDate: t.String(),
            type: t.String(),
            startingParent: t.Union([t.Literal('MOM'), t.Literal('DAD')]),
            handoverTime: t.Optional(t.String()),
            sequence: t.Optional(t.Array(t.Number())),
            holidays: t.Optional(t.Array(t.String()))
        })
    });
