import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSecurity } from "@/context/SecurityContext";
import { authApi } from "@/lib/api/auth";
import { loginWithPasskey } from "@/lib/webauthn-client";
import { clearActivePrivateKey } from "@/lib/e2ee-session";

export function SessionExpiredDialog() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [isUnlocking, setIsUnlocking] = useState(false);
    const [unlockError, setUnlockError] = useState<string | null>(null);
    const [open, setOpen] = useState(false);
    const {
        isLocked,
        hasJustExpired,
        refreshE2eeSessionState,
        lockForLogout,
        clearExpiryFlag,
        clearCurrentUserId,
    } = useSecurity();

    useEffect(() => {
        authApi.getMe()
            .then((me) => {
                setUserEmail(me?.user?.email || null);
                setUserId(me?.user?.id || null);
            })
            .catch(() => {
                setUserEmail(null);
                setUserId(null);
            });
    }, [isLocked, hasJustExpired]);

    useEffect(() => {
        setOpen(isLocked && hasJustExpired);
    }, [isLocked, hasJustExpired]);

    const handleUnlock = async () => {
        if (!userEmail) {
            setUnlockError(t('common.privateKeyMissing'));
            return;
        }

        setIsUnlocking(true);
        setUnlockError(null);
        try {
            const success = await loginWithPasskey(userEmail);
            if (!success) {
                setUnlockError(t('security.notification.actionLocked.desc'));
                return;
            }

            const refreshed = await refreshE2eeSessionState();
            if (refreshed) {
                clearExpiryFlag();
                setOpen(false);
            } else {
                setUnlockError(t('common.privateKeyMissing'));
            }
        } catch (error) {
            setUnlockError(error instanceof Error ? error.message : t('settings.encryption.locked'));
        } finally {
            setIsUnlocking(false);
        }
    };

    const handleLogout = async () => {
        lockForLogout();
        try {
            await clearActivePrivateKey(userId).catch((error) => {
                console.error("Failed to clear local E2EE session during session-expired logout", error);
            });
            await authApi.logout();
        } catch (error) {
            console.error("Failed to log out after session expiry", error);
        } finally {
            clearExpiryFlag();
            setOpen(false);
            clearCurrentUserId();
            navigate("/auth");
        }
    };

    return (
        <Dialog open={open} onOpenChange={() => { }}>
            <DialogContent className="max-w-md" hideClose>
                <DialogHeader>
                    <DialogTitle>{t("security.notification.expired.title")}</DialogTitle>
                    <DialogDescription>{t("security.notification.expired.desc")}</DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:justify-start">
                    <Button
                        data-testid="session-expired-unlock"
                        onClick={() => void handleUnlock()}
                        disabled={isUnlocking || !userEmail}
                    >
                        {isUnlocking ? t("settings.encryption.unlocking") : t("settings.encryption.unlockButton")}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => void handleLogout()}>
                        {t("sidebar.logout")}
                    </Button>
                </DialogFooter>
                {unlockError && <p className="text-sm text-red-600" data-testid="session-expired-error">{unlockError}</p>}
            </DialogContent>
        </Dialog>
    );
}
