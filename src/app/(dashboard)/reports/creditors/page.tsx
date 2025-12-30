"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QBOProtected } from "@/components/qbo/QBOProtected";
import { Loader2 } from "lucide-react";

export default function CreditorsPage() {
    return (
        <QBOProtected>
            <CreditorsContent />
        </QBOProtected>
    );
}

function CreditorsContent() {
    const [reportData, setReportData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/qbo/reports/aged-payables')
            .then(res => res.json())
            .then(data => {
                setReportData(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;
    }

    if (!reportData || !reportData.Rows) {
        return <div className="text-red-500 p-4">Failed to load report data.</div>;
    }

    const columns = reportData.Columns.Column;
    const rows = reportData.Rows.Row;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-foreground gradient-text">Creditors Outstanding</h1>
            <Card className="glass border-white/10">
                <CardHeader>
                    <CardTitle className="text-foreground">Vendor Payables</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-white/10">
                            <thead className="bg-white/5">
                                <tr>
                                    {columns.map((col: any, i: number) => (
                                        <th key={i} className="px-6 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                            {col.ColTitle}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-transparent divide-y divide-white/10">
                                {rows && rows.map((row: any, i: number) => {
                                    if (!row.ColData) return null;
                                    return (
                                        <tr key={i} className="hover:bg-white/5 transition-colors">
                                            {row.ColData.map((cell: any, j: number) => (
                                                <td key={j} className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                                                    {cell.value}
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {(!rows || rows.length === 0) && (
                            <p className="text-center p-8 text-muted-foreground">No outstanding bills found.</p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
