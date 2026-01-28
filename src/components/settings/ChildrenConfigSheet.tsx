import { useState } from "react";
import { Plus, Trash2, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

// Placeholder type until we have frontend domain or api client shared types
interface Child {
    id: string;
    name: string;
    color: string;
}

export function ChildrenConfigSheet() {
    const { t } = useTranslation();
    const [children, setChildren] = useState<Child[]>([
        { id: "1", name: "Alice", color: "#FFC0CB" }, // Pink
        { id: "2", name: "Bob", color: "#87CEEB" }    // Blue
    ]);
    const [newChildName, setNewChildName] = useState("");
    const [newChildColor, setNewChildColor] = useState("#FFC0CB");

    const handleAddChild = () => {
        if (!newChildName.trim()) return;
        const newChild: Child = {
            id: crypto.randomUUID(),
            name: newChildName,
            color: newChildColor
        };
        setChildren([...children, newChild]);
        setNewChildName("");
        // Persist to backend...
    };

    const handleDeleteChild = (id: string) => {
        setChildren(children.filter(c => c.id !== id));
        // Synce with backend...
    };

    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <User className="h-4 w-4" />
                    Manage Children
                </Button>
            </SheetTrigger>
            <SheetContent>
                <SheetHeader>
                    <SheetTitle>Children Configuration</SheetTitle>
                    <SheetDescription>
                        Manage your children profiles and their associated colors for the calendar.
                    </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                    {/* Add New Child */}
                    <div className="space-y-4 border-b pb-6">
                        <h3 className="text-sm font-medium">Add Child</h3>
                        <div className="grid gap-2">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                value={newChildName}
                                onChange={(e) => setNewChildName(e.target.value)}
                                placeholder="Child's Name"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="color">Color</Label>
                            <div className="flex gap-2 items-center">
                                <Input
                                    id="color"
                                    type="color"
                                    value={newChildColor}
                                    onChange={(e) => setNewChildColor(e.target.value)}
                                    className="w-12 h-9 p-1"
                                />
                                <span className="text-sm text-muted-foreground">{newChildColor}</span>
                            </div>
                        </div>
                        <Button onClick={handleAddChild} className="w-full">
                            <Plus className="w-4 h-4 mr-2" /> Add Child
                        </Button>
                    </div>

                    {/* List Children */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-medium">Children List</h3>
                        {children.map(child => (
                            <Card key={child.id} className="overflow-hidden">
                                <CardContent className="p-3 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-8 h-8 rounded-full border shadow-sm"
                                            style={{ backgroundColor: child.color }}
                                        />
                                        <span className="font-medium">{child.name}</span>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-muted-foreground hover:text-destructive"
                                        onClick={() => handleDeleteChild(child.id)}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
