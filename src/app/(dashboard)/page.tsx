import { KPICards } from "@/components/dashboard/KPICards";
import { CashFlowChart } from "@/components/dashboard/CashFlowChart";
import { ExpenseChart } from "@/components/dashboard/ExpenseChart";
import { SyncStatus } from "@/components/dashboard/SyncStatus";
import { QBOProtected } from "@/components/qbo/QBOProtected";

export default function DashboardPage() {
  return (
    <QBOProtected>
      <div className="space-y-8">
        {/* 1. Top Section: Key Performance Indicators */}
        <section className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <KPICards />
        </section>

        {/* 2. Middle Section: Charts & Status */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          {/* Main Chart - Takes 2 columns */}
          <div className="lg:col-span-2">
            <CashFlowChart />
          </div>

          {/* Side Panel - Sync Status & Expense Split */}
          <div className="space-y-6">
            <SyncStatus />
            <ExpenseChart />
          </div>
        </section>
      </div>
    </QBOProtected>
  );
}
