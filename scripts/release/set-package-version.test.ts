import { describe, expect, test } from "bun:test";
import { updatePackageVersionContent } from "./set-package-version";

describe("updatePackageVersionContent", () => {
    test("updates only the version field and preserves formatting", () => {
        const nextContent = updatePackageVersionContent(
            '{\n  "name": "tmp_app",\n  "version": "0.0.0-SNAPSHOT",\n  "private": true\n}\n',
            "1.2.3"
        );

        expect(nextContent).toBe('{\n  "name": "tmp_app",\n  "version": "1.2.3",\n  "private": true\n}\n');
    });
});
