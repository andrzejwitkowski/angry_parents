import { useTranslation } from 'react-i18next';
import { useSecurity } from '@/context/SecurityContext';
import { RotateCcw, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface SecurityTimerProps {
    isCollapsed?: boolean;
}

export const SecurityTimer: React.FC<SecurityTimerProps> = ({ isCollapsed }) => {
    const { t } = useTranslation();
    const { timeRemaining, isLocked, resetTimer } = useSecurity();

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (isLocked) {
        return (
            <div
                data-testid="security-timer"
                className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive border border-destructive/20",
                    isCollapsed && "justify-center px-0"
                )}
            >
                <Lock className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span data-testid="locked-status" className="text-xs font-bold whitespace-nowrap">{t('security.timer.locked')}</span>}
                {isCollapsed && <span data-testid="locked-status" className="sr-only">{t('security.timer.locked')}</span>}
            </div>
        );
    }

    const isUrgent = timeRemaining < 60;

    return (
        <TooltipProvider>
            <div
                data-testid="security-timer"
                className={cn(
                    "flex items-center gap-2 p-1 rounded-lg bg-slate-800/50 border border-slate-700/50 transition-colors",
                    isUrgent && "bg-amber-900/20 border-amber-500/30",
                    isCollapsed && "flex-col py-2"
                )}
            >
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div
                            data-testid="timer-countdown"
                            className={cn(
                                "flex items-center justify-center font-mono text-xs font-bold tabular-nums min-w-[45px]",
                                isUrgent ? "text-amber-400 animate-pulse" : "text-slate-300"
                            )}
                        >
                            {!isCollapsed ? formatTime(timeRemaining) : formatTime(timeRemaining).split(':')[0]}
                        </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                        Session timeout in {formatTime(timeRemaining)}
                    </TooltipContent>
                </Tooltip>

                <Button
                    data-testid="timer-refresh"
                    variant="ghost"
                    size="icon"
                    className={cn(
                        "h-7 w-7 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md",
                        isUrgent && "text-amber-400 hover:bg-amber-900/40"
                    )}
                    onClick={resetTimer}
                >
                    <RotateCcw className="w-3.5 h-3.5" />
                </Button>
            </div>
        </TooltipProvider>
    );
};
