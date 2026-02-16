import { useState } from "react";
import { Link } from "react-router-dom";
import {
    ChevronLeft,
    MoreHorizontal,
    Link as LinkIcon,
    Eye,
    EyeOff,
    Save,
    HelpCircle,
    ExternalLink,
    User,
    Bell,
    Home,
    Calendar,
    MessageSquare,
    Settings as SettingsIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Settings() {
    const [apiKey, setApiKey] = useState("");
    const [showKey, setShowKey] = useState(false);

    const handleSave = () => {
        // TODO: Implement actual save logic (e.g., to backend or local storage)
        console.log("Saving API Key:", apiKey);
        alert("API Key saved (check console)");
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 pb-20">
            {/* Mobile Header */}
            <header className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link to="/dashboard" className="p-1 -ml-1 text-slate-500 hover:text-primary transition-colors">
                        <ChevronLeft className="w-6 h-6" />
                    </Link>
                    <h1 className="text-lg font-semibold tracking-tight">Integrations</h1>
                </div>
                <div className="flex items-center">
                    <MoreHorizontal className="w-6 h-6 text-slate-400" />
                </div>
            </header>

            <main className="max-w-md mx-auto px-4 py-6 space-y-6">
                {/* Breadcrumb / Context Info */}
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">External Tools</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Connect your co-parenting data with external platforms to keep your records synchronized and organized.
                    </p>
                </div>

                {/* Integration Status Badge */}
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
                    </span>
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Pending Setup</span>
                </div>

                {/* Integration Card */}
                <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <CardHeader className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center gap-4 space-y-0">
                        <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                            <LinkIcon className="w-8 h-8" />
                        </div>
                        <div>
                            <CardTitle className="text-base font-semibold">Stitch Integration</CardTitle>
                            <CardDescription className="text-xs">Cloud synchronization service</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="p-5 space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="api-key" className="text-sm font-medium">
                                Stitch API Key
                            </Label>
                            <div className="relative">
                                <Input
                                    id="api-key"
                                    type={showKey ? "text" : "password"}
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder="Enter your API key here..."
                                    className="pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowKey(!showKey)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                                >
                                    {showKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-relaxed italic">
                                You can find your API key in your Stitch dashboard settings under "Developer Keys". Never share this key with anyone.
                            </p>
                        </div>
                        <div className="pt-2">
                            <Button onClick={handleSave} className="w-full gap-2">
                                <Save className="w-4 h-4" />
                                Save Integration
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Documentation Card - recreated with basic div to match look, or could use Card */}
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-5">
                    <div className="flex items-start gap-3">
                        <HelpCircle className="w-5 h-5 text-blue-500 mt-0.5" />
                        <div className="space-y-1">
                            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Need help connecting?</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                Read our integration guide to learn how to generate a secure API key and sync your schedule with third-party calendars.
                            </p>
                            <a className="text-xs font-semibold text-blue-500 inline-flex items-center gap-1 mt-2" href="#">
                                View Documentation
                                <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>
                    </div>
                </div>

                {/* Navigation Placeholder (Desktop Sidebar Equiv) */}
                <div className="pt-4 grid grid-cols-2 gap-3">
                    <button className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl gap-2 hover:bg-slate-50 transition-colors">
                        <User className="w-6 h-6 text-slate-400" />
                        <span className="text-xs font-medium">Profile</span>
                    </button>
                    <button className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl gap-2 hover:bg-slate-50 transition-colors">
                        <Bell className="w-6 h-6 text-slate-400" />
                        <span className="text-xs font-medium">Notifications</span>
                    </button>
                </div>
            </main>

            {/* Bottom Navigation Bar (iOS style) */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-6 py-3 pb-8 flex justify-between items-center z-50">
                <Link to="/dashboard" className="flex flex-col items-center gap-1 text-slate-400 hover:text-primary">
                    <Home className="w-6 h-6" />
                    <span className="text-[10px]">Dashboard</span>
                </Link>
                <button className="flex flex-col items-center gap-1 text-slate-400 hover:text-primary">
                    <Calendar className="w-6 h-6" />
                    <span className="text-[10px]">Calendar</span>
                </button>
                <button className="flex flex-col items-center gap-1 text-slate-400 hover:text-primary">
                    <MessageSquare className="w-6 h-6" />
                    <span className="text-[10px]">Messages</span>
                </button>
                <button className="flex flex-col items-center gap-1 text-blue-500">
                    <SettingsIcon className="w-6 h-6" />
                    <span className="text-[10px] font-semibold">Settings</span>
                </button>
            </nav>
        </div>
    );
}
