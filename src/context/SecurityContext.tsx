import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
    clearActivePrivateKey,
    hasStoredPrivateKey,
    markE2eeSessionLocked,
    markE2eeSessionUnlocked,
    setActiveE2eeUserId,
} from '@/lib/e2ee-session';
import { timelineApi } from '@/lib/api/timeline';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { authApi } from '@/lib/api/auth';

interface SecurityContextType {
    timeRemaining: number;
    isLocked: boolean;
    isE2eeUnlocked: boolean;
    configTimeout: number;
    hasJustExpired: boolean;
    resetTimer: () => void;
    unlockSession: () => void;
    lockForLogout: () => void;
    updateConfig: (seconds: number) => void;
    clearExpiryFlag: () => void;
    ensureUnlocked: () => boolean;
    refreshE2eeSessionState: () => Promise<boolean>;
    getCurrentUserId: () => string | null;
    clearCurrentUserId: () => void;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

const DEFAULT_TIMEOUT = 600; // 10 minutes

const getInitialTimeout = (): number => {
    const saved = localStorage.getItem('session_timeout');
    if (!saved) {
        return DEFAULT_TIMEOUT;
    }
    const parsed = Number.parseInt(saved, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return DEFAULT_TIMEOUT;
    }
    return parsed;
};

/**
 * Starts asynchronous private-key scrubbing for the current user and preserves failure state
 * so later refresh attempts cannot silently reopen the session on stale key material.
 */
function startLockCleanup(
    userId: string | null,
    lockCleanupPromiseRef: React.MutableRefObject<Promise<void> | null>,
    lockCleanupFailedRef: React.MutableRefObject<boolean>
) {
    lockCleanupFailedRef.current = false;

    const cleanupPromise = clearActivePrivateKey(userId).catch((error) => {
        lockCleanupFailedRef.current = true;
        throw error;
    });

    void cleanupPromise.then(() => {
            if (lockCleanupPromiseRef.current === cleanupPromise) {
                lockCleanupPromiseRef.current = null;
            }
        }, () => { });

    lockCleanupPromiseRef.current = cleanupPromise;
}

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { toast } = useToast();
    const { t } = useTranslation();

    // Load config from localStorage
    const [configTimeout, setConfigTimeout] = useState(getInitialTimeout);

    const [timeRemaining, setTimeRemaining] = useState(configTimeout);
    const [isSessionLocked, setIsSessionLocked] = useState(false);
    const [hasJustExpired, setHasJustExpired] = useState(false);
    const [isE2eeUnlocked, setIsE2eeUnlocked] = useState(false);

    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const timerRef = useRef<any>(null);
    const refreshRequestIdRef = useRef(0);
    const lockCleanupPromiseRef = useRef<Promise<void> | null>(null);
    const lockCleanupFailedRef = useRef(false);

    const isLocked = isSessionLocked || !isE2eeUnlocked;

    const refreshE2eeSessionState = useCallback(async () => {
        const requestId = ++refreshRequestIdRef.current;
        let resolvedUserId = currentUserId;

        if (lockCleanupPromiseRef.current) {
            try {
                await lockCleanupPromiseRef.current;
            } catch {
                lockCleanupFailedRef.current = true;
                if (requestId === refreshRequestIdRef.current) {
                    setIsE2eeUnlocked(false);
                    setIsSessionLocked(true);
                }
                return false;
            }
        }

        if (lockCleanupFailedRef.current) {
            if (requestId === refreshRequestIdRef.current) {
                setIsE2eeUnlocked(false);
                setIsSessionLocked(true);
            }
            return false;
        }

        if (!resolvedUserId) {
            try {
                const me = await authApi.getMe();
                resolvedUserId = me?.user?.id || null;

                if (requestId !== refreshRequestIdRef.current) {
                    return false;
                }

                setCurrentUserId(resolvedUserId);
                setActiveE2eeUserId(resolvedUserId);
            } catch {
                if (requestId === refreshRequestIdRef.current) {
                    setIsE2eeUnlocked(false);
                    markE2eeSessionLocked();
                    setIsSessionLocked(true);
                }
                return false;
            }
        }

        try {
            const hasKey = await hasStoredPrivateKey(resolvedUserId);
            if (requestId !== refreshRequestIdRef.current) {
                return false;
            }

            setIsE2eeUnlocked(hasKey);

            if (hasKey) {
                lockCleanupFailedRef.current = false;
                markE2eeSessionUnlocked();
                setIsSessionLocked(false);
                setHasJustExpired(false);
                setTimeRemaining(configTimeout);
                return true;
            } else {
                markE2eeSessionLocked();
                setIsSessionLocked(true);
                return false;
            }
        } catch {
            if (requestId === refreshRequestIdRef.current) {
                setIsE2eeUnlocked(false);
                markE2eeSessionLocked();
                setIsSessionLocked(true);
            }
            return false;
        }
    }, [configTimeout, currentUserId]);

    // Initial load: get user to know whose key to clear later
    useEffect(() => {
        authApi.getMe().then(me => {
            const nextUserId = me?.user?.id || null;
            setActiveE2eeUserId(nextUserId);
            setCurrentUserId(nextUserId);
        }).catch(() => { });
    }, []);

    const lockSession = useCallback(() => {
        refreshRequestIdRef.current += 1;

        // ALWAYS lock the session state immediately
        setIsSessionLocked(true);
        setHasJustExpired(true);
        setIsE2eeUnlocked(false);
        markE2eeSessionLocked();
        timelineApi.clearDecryptionCaches();

        toast({
            title: t('security.notification.expired.title'),
            description: t('security.notification.expired.desc'),
            variant: 'destructive',
        });

        startLockCleanup(currentUserId, lockCleanupPromiseRef, lockCleanupFailedRef);
    }, [t, toast, currentUserId]);

    const resetTimer = useCallback(() => {
        setTimeRemaining(configTimeout);
        setIsSessionLocked(!isE2eeUnlocked);
        setHasJustExpired(false);
        if (isE2eeUnlocked) {
            markE2eeSessionUnlocked();
        }
    }, [configTimeout, isE2eeUnlocked]);

    const unlockSession = useCallback(() => {
        setTimeRemaining(configTimeout);
        setIsSessionLocked(false);
        setHasJustExpired(false);
        markE2eeSessionUnlocked();
    }, [configTimeout]);

    const lockForLogout = useCallback(() => {
        refreshRequestIdRef.current += 1;
        setTimeRemaining(0);
        setIsSessionLocked(true);
        setHasJustExpired(false);
        setIsE2eeUnlocked(false);
        markE2eeSessionLocked();
        timelineApi.clearDecryptionCaches();
        startLockCleanup(currentUserId, lockCleanupPromiseRef, lockCleanupFailedRef);
    }, [currentUserId]);

    const updateConfig = useCallback((seconds: number) => {
        setConfigTimeout(seconds);
        localStorage.setItem('session_timeout', seconds.toString());
        setTimeRemaining(seconds);
    }, []);

    const clearExpiryFlag = useCallback(() => {
        setHasJustExpired(false);
    }, []);

    const ensureUnlocked = useCallback(() => {
        if (isLocked || !isE2eeUnlocked) {
            toast({
                title: t('security.notification.actionLocked.title'),
                description: t('security.notification.actionLocked.desc'),
                variant: 'destructive',
            });
            return false;
        }
        resetTimer(); // Also reset timer on successful interaction
        return true;
    }, [isLocked, isE2eeUnlocked, t, toast, resetTimer]);

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
            isE2eeUnlocked,
            configTimeout,
            hasJustExpired,
            resetTimer,
            unlockSession,
            lockForLogout,
            updateConfig,
            clearExpiryFlag,
            ensureUnlocked,
            refreshE2eeSessionState,
            getCurrentUserId: () => currentUserId,
            clearCurrentUserId: () => {
                setCurrentUserId(null);
                setActiveE2eeUserId(null);
            },
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
