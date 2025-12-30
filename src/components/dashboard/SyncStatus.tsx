"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, RefreshCw, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SyncStatus() {
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState("15 mins ago");

    const handleSyncNow = async () => {
        setIsSyncing(true);
        try {
            // Trigger a page reload to refresh all data
            window.location.reload();
        } catch (error) {
            console.error("Sync failed:", error);
            setIsSyncing(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm font-medium">System Status</CardTitle>
                <CardDescription>Overall connectivity & sync health</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Bank Upload Status */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-green-100 p-2 rounded-full">
                            <UploadCloud className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-700">Bank Statement Upload</p>
                            <p className="text-xs text-slate-500">Last uploaded: 2 hours ago</p>
                        </div>
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>

                <div className="border-t border-slate-100 my-2" />

                {/* QBO Sync Status */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`bg-blue-100 p-2 rounded-full ${isSyncing ? 'animate-spin' : ''}`}>
                            <RefreshCw className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-700">QuickBooks Online Sync</p>
                            <p className="text-xs text-slate-500">
                                {isSyncing ? 'Syncing...' : `Last sync: ${lastSyncTime}`}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <span
                            onClick={handleSyncNow}
                            className={`text-xs font-medium text-blue-600 cursor-pointer hover:underline ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isSyncing ? 'Syncing...' : 'Sync Now'}
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
