export function updatePackageVersionContent(content: string, version: string): string {
    const packageJson = JSON.parse(content) as Record<string, unknown>;
    packageJson.version = version;
    return `${JSON.stringify(packageJson, null, 2)}\n`;
}

async function main() {
    const version = process.argv[2];

    if (!version) {
        throw new Error("Usage: bun scripts/release/set-package-version.ts <version>");
    }

    const packageFile = Bun.file("package.json");
    const content = await packageFile.text();
    await Bun.write(packageFile, updatePackageVersionContent(content, version));
    console.log(`package.json version set to ${version}`);
}

if (import.meta.main) {
    main().catch((error) => {
        console.error(error instanceof Error ? error.message : "Unknown package version error.");
        process.exit(1);
    });
}
