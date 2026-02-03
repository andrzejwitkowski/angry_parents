const API_BASE = "/api/children";

export interface Child {
    id: string;
    name: string;
    icon: string;
    color: string;
}

export const childApi = {
    async getAll(): Promise<Child[]> {
        const response = await fetch(API_BASE);
        if (!response.ok) throw new Error("Failed to fetch children");
        return await response.json();
    },

    async add(child: Omit<Child, "id">): Promise<Child> {
        const response = await fetch(API_BASE, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(child)
        });
        if (!response.ok) throw new Error("Failed to add child");
        return await response.json();
    },

    async update(id: string, updates: Partial<Child>): Promise<Child> {
        const response = await fetch(`${API_BASE}/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates)
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Failed to update child");
        }
        return await response.json();
    },

    async delete(id: string): Promise<void> {
        const response = await fetch(`${API_BASE}/${id}`, {
            method: "DELETE"
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Failed to delete child");
        }
    }
};
