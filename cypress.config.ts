import { defineConfig } from "cypress";

export default defineConfig({
    e2e: {
        baseUrl: "http://localhost:5173",
        supportFile: false,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        setupNodeEvents(_on, _config) {
            // implement node event listeners here
        },
        viewportWidth: 1280,
        viewportHeight: 800,
    },
});
