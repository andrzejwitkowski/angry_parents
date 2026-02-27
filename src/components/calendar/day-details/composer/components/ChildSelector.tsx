import { useChildren } from "@/hooks/useChildren";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ChildSelectorProps {
    selectedIds: string[];
    onChange: (ids: string[]) => void;
}

export function ChildSelector({ selectedIds, onChange }: ChildSelectorProps) {
    const { children } = useChildren();

    const toggleChild = (id: string) => {
        if (selectedIds.includes(id)) {
            onChange(selectedIds.filter(childId => childId !== id));
        } else {
            onChange([...selectedIds, id]);
        }
    };

    return (
        <div className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Relates to:</span>
            <div className="flex flex-wrap gap-2">
                {children.map(child => {
                    const isSelected = selectedIds.includes(child.id);
                    return (
                        <Badge
                            key={child.id}
                            variant="outline"
                            data-testid="child-badge"
                            className={cn(
                                "cursor-pointer transition-all px-3 py-1 text-sm font-semibold border-2",
                                isSelected
                                    ? "shadow-md scale-105"
                                    : "opacity-60 grayscale-[0.5] hover:opacity-100 hover:grayscale-0"
                            )}
                            style={{
                                backgroundColor: isSelected ? `${child.color}20` : "transparent",
                                borderColor: child.color,
                                color: isSelected ? child.color : "inherit"
                            }}
                            onClick={() => toggleChild(child.id)}
                        >
                            {child.name}
                        </Badge>
                    );
                })}
                {children.length === 0 && (
                    <span className="text-xs text-slate-400 italic">No children configured</span>
                )}
            </div>
        </div>
    );
}
