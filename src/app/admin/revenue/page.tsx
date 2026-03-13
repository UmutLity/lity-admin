"use client";

import { DollarSign, CreditCard, TrendingUp, ShoppingCart, Lock } from "lucide-react";

export default function RevenuePage() {
  // Revenue page structure - shown in disabled state until payments are enabled
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <DollarSign className="h-6 w-6 text-primary" /> Revenue & Sales
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Sales intelligence and revenue analytics</p>
      </div>

      {/* Disabled Banner */}
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-6 flex items-start gap-4">
        <div className="p-3 rounded-lg bg-amber-500/10">
          <Lock className="h-6 w-6 text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-amber-400">Payments Not Enabled</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Payment processing is not enabled yet. Once you integrate a payment provider (Stripe, etc.),
            this dashboard will display live revenue data, order analytics, and sales intelligence.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Enable payments in <a href="/admin/settings" className="text-primary hover:underline">Settings → General</a> when ready.
          </p>
        </div>
      </div>

      {/* Preview Structure (greyed out) */}
      <div className="opacity-40 pointer-events-none select-none">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Total Revenue</span>
              <DollarSign className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-bold">$0.00</div>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </div>

          <div className="bg-card border rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Monthly Revenue</span>
              <TrendingUp className="h-4 w-4 text-blue-400" />
            </div>
            <div className="text-3xl font-bold">$0.00</div>
            <p className="text-xs text-muted-foreground mt-1">This month</p>
          </div>

          <div className="bg-card border rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Orders</span>
              <ShoppingCart className="h-4 w-4 text-purple-400" />
            </div>
            <div className="text-3xl font-bold">0</div>
            <p className="text-xs text-muted-foreground mt-1">Total orders</p>
          </div>

          <div className="bg-card border rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Refund Rate</span>
              <CreditCard className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-3xl font-bold">0%</div>
            <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
          </div>
        </div>

        <div className="bg-card border rounded-xl p-6 mt-4">
          <h3 className="text-lg font-semibold mb-4">Revenue Chart</h3>
          <div className="h-64 flex items-center justify-center bg-muted/20 rounded-lg">
            <p className="text-muted-foreground">Chart will appear when payments are enabled</p>
          </div>
        </div>

        <div className="bg-card border rounded-xl p-6 mt-4">
          <h3 className="text-lg font-semibold mb-4">Recent Orders</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3">Order ID</th>
                <th className="text-left py-2 px-3">Customer</th>
                <th className="text-left py-2 px-3">Product</th>
                <th className="text-left py-2 px-3">Amount</th>
                <th className="text-left py-2 px-3">Status</th>
                <th className="text-left py-2 px-3">Date</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={6} className="text-center py-8 text-muted-foreground">
                  No orders yet
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
