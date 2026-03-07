import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { clearPrivateKey } from '@/lib/idb-crypto';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { authApi } from '@/lib/api/auth';

interface SecurityContextType {
    timeRemaining: number;
    isLocked: boolean;
    configTimeout: number;
    hasJustExpired: boolean;
    resetTimer: () => void;
    updateConfig: (seconds: number) => void;
    clearExpiryFlag: () => void;
    ensureUnlocked: () => boolean;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

const DEFAULT_TIMEOUT = 600; // 10 minutes

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { toast } = useToast();
    const { t } = useTranslation();

    // Load config from localStorage
    const [configTimeout, setConfigTimeout] = useState(() => {
        const saved = localStorage.getItem('session_timeout');
        return saved ? parseInt(saved, 10) : DEFAULT_TIMEOUT;
    });

    const [timeRemaining, setTimeRemaining] = useState(configTimeout);
    const [isLocked, setIsLocked] = useState(false);
    const [hasJustExpired, setHasJustExpired] = useState(false);

    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const timerRef = useRef<any>(null);

    // Initial load: get user to know whose key to clear later
    useEffect(() => {
        authApi.getMe().then(me => {
            if (me?.user?.id) setCurrentUserId(me.user.id);
        }).catch(() => { });
    }, []);

    const lockSession = useCallback(() => {
        // ALWAYS lock the session state immediately
        setIsLocked(true);
        setHasJustExpired(true);

        toast({
            title: t('security.notification.expired.title'),
            description: t('security.notification.expired.desc'),
            variant: 'destructive',
        });

        // Fire-and-forget the key clearing
        if (currentUserId) {
            clearPrivateKey(currentUserId).catch(err =>
                console.error('Error clearing private key during lock:', err)
            );
        }
    }, [t, toast, currentUserId]);

    const resetTimer = useCallback(() => {
        setTimeRemaining(configTimeout);
        setIsLocked(false);
        setHasJustExpired(false);
    }, [configTimeout]);

    const updateConfig = useCallback((seconds: number) => {
        setConfigTimeout(seconds);
        localStorage.setItem('session_timeout', seconds.toString());
        setTimeRemaining(seconds);
    }, []);

    const clearExpiryFlag = useCallback(() => {
        setHasJustExpired(false);
    }, []);

    const ensureUnlocked = useCallback(() => {
        if (isLocked) {
            toast({
                title: t('security.notification.actionLocked.title'),
                description: t('security.notification.actionLocked.desc'),
                variant: 'destructive',
            });
            return false;
        }
        resetTimer(); // Also reset timer on successful interaction
        return true;
    }, [isLocked, t, toast, resetTimer]);

    useEffect(() => {
        if (isLocked) return;

        timerRef.current = setInterval(() => {
            setTimeRemaining((prev) => {
                if (prev <= 1) {
                    if (timerRef.current) clearInterval(timerRef.current);
                    lockSession();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isLocked, lockSession]);

    // Reset timer on visibility change (optional, but good for UX)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && !isLocked) {
                // If we were away for a long time, the interval might not have caught up
                // For simplicity, we just keep going, but we could check timestamps here
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [isLocked]);

    return (
        <SecurityContext.Provider value={{
            timeRemaining,
            isLocked,
            configTimeout,
            hasJustExpired,
            resetTimer,
            updateConfig,
            clearExpiryFlag,
            ensureUnlocked
        }}>
            {children}
        </SecurityContext.Provider>
    );
};

export const useSecurity = () => {
    const context = useContext(SecurityContext);
    if (!context) {
        throw new Error('useSecurity must be used within a SecurityProvider');
    }
    return context;
};
