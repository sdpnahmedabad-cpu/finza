"use client";

import { SyncStatus } from "@/components/dashboard/SyncStatus";

export default function SyncStatusPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-foreground gradient-text">QBO Sync Status</h1>
            <div className="max-w-2xl">
                <SyncStatus />
            </div>
        </div>
    );
}
