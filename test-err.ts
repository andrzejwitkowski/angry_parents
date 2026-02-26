import { TestApi } from "./tests/e2e-backend/utils/api";
async function run() {
    const api = new TestApi("http://localhost:3000");
    const res = await api.post("/api/auth/mock-register", {
        email: "orphan@test.com",
        name: "Orphan Parent",
        gender: "dad"
    });
    console.log(res.status, await res.text());
}
run();
