import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { authClient } from "@/lib/auth-client";

/**
 * AdminRoute wrapper for RBAC protection.
 * - Always allowed in "development" environment (optional, but per requirement).
 * - Requires "developer" role and Yubico key (webauthnCredentialId) in test/prod.
 */
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
    const { data: session, isPending } = authClient.useSession();
    const location = useLocation();

    // Check environment (using Vite's env)
    const isDev = import.meta.env.MODE === "development";

    if (isPending) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-zinc-950">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-800 border-t-indigo-500" />
            </div>
        );
    }

    // Bypass check for DEV
    if (isDev) {
        return <>{children}</>;
    }

    // Strict checks for non-DEV
    if (!session || !session.user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    const { role, webauthnCredentialId } = session.user as any;

    if (role !== "developer") {
        return <Navigate to="/" replace />;
    }

    // Requirement: Must login with YubiKey (checked via existence of credentialId on user session)
    if (!webauthnCredentialId) {
        return <Navigate to="/login" state={{ needsKey: true }} replace />;
    }

    return <>{children}</>;
};

export default AdminRoute;
