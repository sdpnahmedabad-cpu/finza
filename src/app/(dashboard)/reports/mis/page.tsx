"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid, PieChart, Pie, Cell } from "recharts";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function MISReportsPage() {
    const [pnlData, setPnlData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);

    const [dateRange, setDateRange] = useState({ start: '', end: '' });

    // Initialize with Last Month
    useEffect(() => {
        const now = new Date();
        const firstDayPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        setDateRange({
            start: firstDayPrevMonth.toISOString().split('T')[0],
            end: lastDayPrevMonth.toISOString().split('T')[0]
        });
    }, []);

    const fetchReports = () => {
        if (!dateRange.start || !dateRange.end) return;

        setLoading(true);
        const query = `?start_date=${dateRange.start}&end_date=${dateRange.end}`;

        fetch(`/api/qbo/reports/profit-and-loss${query}`)
            .then(res => res.json())
            .then(data => {
                setPnlData(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("MIS Fetch Error:", err);
                setLoading(false);
            });
    };

    useEffect(() => {
        if (dateRange.start && dateRange.end) {
            const handler = setTimeout(() => {
                fetchReports();
            }, 3000);

            return () => {
                clearTimeout(handler);
            };
        }
    }, [dateRange]);

    // Extract key metrics from P&L
    // Note: This relies on standard QBO P&L structure (Income, Expenses, Net Income)
    const getMetric = (rows: any[], groupName: string): number => {
        if (!rows) return 0;
        // Search recursively or at top level
        for (const row of rows) {
            if (row.group === groupName) {
                return parseFloat(row.Summary.ColData[1].value); // Assuming col 1 is value
            }
            if (row.Rows?.Row) {
                const found: number = getMetric(row.Rows.Row, groupName);
                if (found) return found;
            }
        }
        return 0;
    };

    // Simplification: Iterate top level rows to find "Income" and "Expenses" sections
    // --- Metric Calculation ---
    let totalIncome = 0;
    let totalExpenses = 0;
    let totalCOGS = 0;
    let netIncome = 0;
    const expenseBreakdown: { name: string, value: number }[] = [];

    if (pnlData?.Rows?.Row) {
        const rows = pnlData.Rows.Row;
        rows.forEach((row: any) => {
            const group = row.group;
            const value = parseFloat(row.Summary?.ColData?.[1]?.value || "0");

            if (group === "Income") {
                totalIncome = value;
            }
            else if (group === "Cost of Goods Sold" || group === "COGS") {
                totalCOGS = value;
            }
            else if (group === "Expenses") {
                totalExpenses = value;

                // Extract top-level specific expenses for Pie Chart
                if (row.Rows?.Row) {
                    row.Rows.Row.forEach((subRow: any) => {
                        const subValStr = subRow.type === 'Section'
                            ? subRow.Summary?.ColData?.[1]?.value
                            : subRow.ColData?.[1]?.value;

                        const subVal = parseFloat(subValStr || "0");
                        const subName = subRow.type === 'Section'
                            ? (subRow.Header?.ColData?.[0]?.value || subRow.group)
                            : subRow.ColData?.[0]?.value;

                        if (subVal > 0 && subName) {
                            expenseBreakdown.push({ name: subName, value: subVal });
                        }
                    });
                }
            }
        });

        // Final Net Income check
        const lastRow = rows[rows.length - 1];
        if (lastRow?.group === "Net Income") {
            netIncome = parseFloat(lastRow.Summary?.ColData?.[1]?.value || "0");
        } else {
            netIncome = totalIncome - totalExpenses - totalCOGS; // Fallback
        }
    }

    // Sort and limit expense breakdown for Chart
    const topExpenses = expenseBreakdown
        .sort((a, b) => b.value - a.value)
        .slice(0, 5); // Top 5

    // Ratios
    const grossProfit = totalIncome - totalCOGS;
    const grossMargin = totalIncome > 0 ? (grossProfit / totalIncome) * 100 : 0;
    const netMargin = totalIncome > 0 ? (netIncome / totalIncome) * 100 : 0;
    const expenseRatio = totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0;

    const chartData = [
        { name: "Income", amount: totalIncome },
        { name: "Expenses", amount: totalExpenses },
        { name: "Net Profit", amount: netIncome },
    ];

    const handleExport = async () => {
        if (!pnlData || !pnlData.Rows) {
            alert("No data available to export.");
            return;
        }

        try {
            setExporting(true);
            const doc = new jsPDF();
            const title = "MIS Report - Financial Analysis";
            const currencySymbol = pnlData.Header?.Currency || "USD";

            // Title
            doc.setFontSize(18);
            doc.text(title, 14, 20);

            // Period
            doc.setFontSize(10);
            if (pnlData.Header?.StartPeriod) {
                doc.text(`For ${pnlData.Header.StartPeriod} to ${pnlData.Header.EndPeriod}`, 14, 28);
            }

            // --- Summary Metrics ---
            doc.setFontSize(12);
            doc.text("Executive Summary", 14, 38);

            const summaryData = [
                ["Total Income", `${currencySymbol} ${totalIncome.toLocaleString()}`],
                ["Cost of Goods Sold", `${currencySymbol} ${totalCOGS.toLocaleString()}`],
                ["Gross Profit", `${currencySymbol} ${grossProfit.toLocaleString()}`],
                ["Total Expenses", `${currencySymbol} ${totalExpenses.toLocaleString()}`],
                ["Net Profit", `${currencySymbol} ${netIncome.toLocaleString()}`],
                ["", ""],
                ["Gross Margin", `${grossMargin.toFixed(1)}%`],
                ["Net Margin", `${netMargin.toFixed(1)}%`],
                ["Expense Ratio", `${expenseRatio.toFixed(1)}%`]
            ];

            autoTable(doc, {
                startY: 42,
                head: [['Metric', 'Value']],
                body: summaryData,
                theme: 'striped',
                headStyles: { fillColor: [66, 66, 66] }
            });

            // --- Charts Capture ---
            const finalYSummary = (doc as any).lastAutoTable.finalY + 10;
            let currentY = finalYSummary;

            // Capture Bar Chart
            const barChartParams = document.getElementById('mis-chart-income-vs-expenses');
            if (barChartParams) {
                const canvas = await html2canvas(barChartParams, { scale: 2 });
                const imgData = canvas.toDataURL('image/png');
                const imgWidth = 180; // Max width for A4
                const imgHeight = (canvas.height * imgWidth) / canvas.width;

                doc.text("Income vs Expenses", 14, currentY);
                doc.addImage(imgData, 'PNG', 14, currentY + 5, imgWidth, imgHeight);
                currentY += imgHeight + 15;
            }

            // Capture Pie Chart
            // Check if we need a new page
            if (currentY > 200) {
                doc.addPage();
                currentY = 20;
            }

            const pieChartParams = document.getElementById('mis-chart-expense-breakdown');
            if (pieChartParams) {
                const canvas = await html2canvas(pieChartParams, { scale: 2 });
                const imgData = canvas.toDataURL('image/png');
                const imgWidth = 180;
                const imgHeight = (canvas.height * imgWidth) / canvas.width;

                doc.text("Expense Breakdown", 14, currentY);
                doc.addImage(imgData, 'PNG', 14, currentY + 5, imgWidth, imgHeight);
                currentY += imgHeight + 15;
            }


            // --- Detailed Breakdown ---
            if (currentY > 250) {
                doc.addPage();
                currentY = 20;
            }

            const tableRows: any[] = [];

            const processRow = (row: any, indentLevel: number) => {
                const indent = "  ".repeat(indentLevel);

                if (row.type === 'Section') {
                    const headerVal = row.Header?.ColData?.[0]?.value || row.group;
                    if (headerVal) {
                        tableRows.push([
                            { content: indent + headerVal, styles: { fontStyle: 'bold', fillColor: [245, 245, 245] } },
                            ""
                        ]);
                    }
                    if (row.Rows?.Row) {
                        row.Rows.Row.forEach((subRow: any) => processRow(subRow, indentLevel + 1));
                    }
                    if (row.Summary) {
                        const sumLabel = row.Summary.ColData?.[0]?.value;
                        const sumVal = row.Summary.ColData?.[row.Summary.ColData.length - 1]?.value;
                        tableRows.push([
                            { content: indent + "TOTAL " + sumLabel, styles: { fontStyle: 'bold' } },
                            { content: sumVal, styles: { fontStyle: 'bold', halign: 'right' } }
                        ]);
                    }
                }
                else if (row.type === 'Data' && row.ColData) {
                    const label = row.ColData[0]?.value;
                    const val = row.ColData[row.ColData.length - 1]?.value;
                    tableRows.push([
                        indent + label,
                        { content: val, styles: { halign: 'right' } }
                    ]);
                }
            };

            if (pnlData.Rows?.Row) {
                pnlData.Rows.Row.forEach((row: any) => processRow(row, 0));
            }

            doc.text("Detailed Breakdown", 14, currentY);

            autoTable(doc, {
                startY: currentY + 5,
                head: [['Particulars', 'Amount']],
                body: tableRows,
                styles: { fontSize: 10 },
                headStyles: { fillColor: [41, 128, 185] },
                columnStyles: {
                    0: { cellWidth: 100, fontStyle: 'bold' },
                    1: { cellWidth: 50, halign: 'right' }
                }
            });

            // Save PDF
            const dateStr = new Date().toISOString().split('T')[0];
            doc.save(`MIS_Analysis_${dateStr}.pdf`);

            setExporting(false);

        } catch (error: any) {
            console.error("Export failed:", error);
            alert("Export failed: " + (error.message || "Unknown error"));
            setExporting(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-foreground gradient-text">MIS Reports</h1>
                    <p className="text-muted-foreground">Financial Performance & Analysis</p>
                </div>
                <div className="flex gap-2 items-center">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">From:</span>
                        <input
                            type="date"
                            className="border border-white/10 rounded px-2 py-1 text-sm bg-black/20 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            value={dateRange.start}
                            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                        />
                        <span className="text-sm text-muted-foreground">To:</span>
                        <input
                            type="date"
                            className="border border-white/10 rounded px-2 py-1 text-sm bg-black/20 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            value={dateRange.end}
                            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                        />
                    </div>
                    <Button variant="outline" onClick={fetchReports} className="border-white/10 hover:bg-white/5 hover:text-primary"><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
                    <Button variant="outline" onClick={handleExport} disabled={loading || exporting} className="border-white/10 hover:bg-white/5 hover:text-primary">
                        {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        {exporting ? 'Exporting...' : 'Export PDF'}
                    </Button>
                </div>
            </div>

            {/* Overview Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="glass border-white/10">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Income</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-500 shadow-green-500/20 drop-shadow-sm">
                            {pnlData?.Header?.Currency} {totalIncome.toLocaleString()}
                        </div>
                    </CardContent>
                </Card>
                <Card className="glass border-white/10">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-500 shadow-red-500/20 drop-shadow-sm">
                            {pnlData?.Header?.Currency} {totalExpenses.toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Ratio: {expenseRatio.toFixed(1)}%
                        </p>
                    </CardContent>
                </Card>
                <Card className="glass border-white/10">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Net Profit</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${netIncome >= 0 ? "text-blue-500 shadow-blue-500/20" : "text-red-500 shadow-red-500/20"} drop-shadow-sm`}>
                            {pnlData?.Header?.Currency} {netIncome.toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Margin: {netMargin.toFixed(1)}%
                        </p>
                    </CardContent>
                </Card>
                <Card className="glass border-white/10">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Gross Profit</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">
                            {pnlData?.Header?.Currency} {grossProfit.toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Margin: {grossMargin.toFixed(1)}%
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card className="glass border-white/10">
                    <CardHeader>
                        <CardTitle className="text-foreground">Income vs Expenses</CardTitle>
                        <CardDescription className="text-muted-foreground">Performance Overview</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] bg-transparent p-2" id="mis-chart-income-vs-expenses">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                                    <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                        contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                    />
                                    <Legend />
                                    <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.name === 'Income' ? '#22c55e' : entry.name === 'Net Profit' ? '#3b82f6' : '#ef4444'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="glass border-white/10">
                    <CardHeader>
                        <CardTitle className="text-foreground">Expense Breakdown</CardTitle>
                        <CardDescription className="text-muted-foreground">Top 5 Categories</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] bg-transparent p-2" id="mis-chart-expense-breakdown">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={topExpenses}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={true}
                                        label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {topExpenses.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value: number) => value.toLocaleString()}
                                        contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                    />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Detailed Table Placeholder (Optional, can be added if needed) */}
        </div>
    );
}
