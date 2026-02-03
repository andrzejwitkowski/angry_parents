import { useState, useEffect } from "react";
import { childApi, type Child } from "@/lib/api/children";

export function useChildren() {
    const [children, setChildren] = useState<Child[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchChildren = async () => {
        try {
            setIsLoading(true);
            const data = await childApi.getAll();
            setChildren(data);
            setError(null);
        } catch (err) {
            console.error("Failed to fetch children:", err);
            setError("Failed to load children profiles");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchChildren();
    }, []);

    const getChildrenByIds = (ids: string[] = []) => {
        if (!ids) return [];
        return children.filter(child => ids.includes(child.id));
    };

    const getChildById = (id: string) => {
        return children.find(child => child.id === id);
    };

    return {
        children,
        isLoading,
        error,
        getChildrenByIds,
        getChildById,
        refresh: fetchChildren
    };
}
