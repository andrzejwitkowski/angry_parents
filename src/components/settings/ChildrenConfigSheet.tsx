import { useState, useEffect } from "react";
import { Plus, Trash2, User, Loader2 } from "lucide-react";
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
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { childApi, type Child } from "@/lib/api/children";

export function ChildrenConfigSheet() {
    const { t } = useTranslation();
    const [children, setChildren] = useState<Child[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [newChildName, setNewChildName] = useState("");
    const [newChildColor, setNewChildColor] = useState("#FFC0CB");
    const [deleteError, setDeleteError] = useState<{ id: string; message: string } | null>(null);

    const fetchChildren = async () => {
        try {
            setIsLoading(true);
            const data = await childApi.getAll();
            setChildren(data);
        } catch (error) {
            console.error("Failed to fetch children:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchChildren();
    }, []);

    const handleAddChild = async () => {
        if (!newChildName.trim()) return;
        try {
            setIsSaving(true);
            const newChild = await childApi.add({
                name: newChildName,
                color: newChildColor,
                icon: "user" // Default icon
            });
            setChildren([...children, newChild]);
            setNewChildName("");
        } catch (error) {
            console.error("Failed to add child:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateColor = async (id: string, color: string) => {
        try {
            await childApi.update(id, { color });
            setChildren(children.map(c => c.id === id ? { ...c, color } : c));
        } catch (error) {
            console.error("Failed to update child color:", error);
        }
    };

    const handleDeleteChild = async (id: string) => {
        try {
            setDeleteError(null);
            await childApi.delete(id);
            setChildren(children.filter(c => c.id !== id));
        } catch (error) {
            console.error("Failed to delete child:", error);
            setDeleteError({
                id,
                message: error instanceof Error ? error.message : "Failed to delete child"
            });
        }
    };

    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <User className="h-4 w-4" />
                    {t("settings.manageChildren")}
                </Button>
            </SheetTrigger>
            <SheetContent>
                <SheetHeader>
                    <SheetTitle>{t("settings.childrenConfigTitle")}</SheetTitle>
                    <SheetDescription>
                        {t("settings.childrenConfigDesc")}
                    </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                    {/* Add New Child */}
                    <div className="space-y-4 border-b pb-6">
                        <h3 className="text-sm font-medium">{t("settings.addChild")}</h3>
                        <div className="grid gap-2">
                            <Label htmlFor="name">{t("settings.childName")}</Label>
                            <Input
                                id="name"
                                value={newChildName}
                                onChange={(e) => setNewChildName(e.target.value)}
                                placeholder={t("settings.childNamePlaceholder")}
                                disabled={isSaving}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="color">{t("settings.childColor")}</Label>
                            <div className="flex gap-2 items-center">
                                <Input
                                    id="color"
                                    type="color"
                                    value={newChildColor}
                                    onChange={(e) => setNewChildColor(e.target.value)}
                                    className="w-12 h-9 p-1"
                                    disabled={isSaving}
                                />
                                <span className="text-sm text-muted-foreground">{newChildColor}</span>
                            </div>
                        </div>
                        <Button onClick={handleAddChild} className="w-full" disabled={isSaving || !newChildName.trim()}>
                            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                            {t("settings.addChild")}
                        </Button>
                    </div>

                    {/* List Children */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-medium">{t("settings.childrenList")}</h3>
                        {isLoading ? (
                            <div className="flex justify-center p-4">
                                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : children.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">{t("settings.noChildrenYet")}</p>
                        ) : (
                            children.map(child => (
                                <Card key={child.id} className="overflow-hidden">
                                    <CardContent className="p-3 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="relative group cursor-pointer">
                                                <div
                                                    className="w-8 h-8 rounded-full border shadow-sm transition-transform group-hover:scale-110"
                                                    style={{ backgroundColor: child.color }}
                                                />
                                                <input
                                                    type="color"
                                                    value={child.color}
                                                    onChange={(e) => handleUpdateColor(child.id, e.target.value)}
                                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                                />
                                            </div>
                                            <span className="font-medium">{child.name}</span>
                                        </div>
                                        <Popover open={deleteError?.id === child.id} onOpenChange={(open) => !open && setDeleteError(null)}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-muted-foreground hover:text-destructive"
                                                    onClick={() => handleDeleteChild(child.id)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-64 p-3" side="left">
                                                <div className="space-y-2">
                                                    <p className="text-sm font-medium text-destructive">{t("settings.cannotDeleteChild")}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {deleteError?.message}
                                                    </p>
                                                    <Button variant="outline" size="sm" className="w-full" onClick={() => setDeleteError(null)}>
                                                        {t("settings.dismiss")}
                                                    </Button>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
