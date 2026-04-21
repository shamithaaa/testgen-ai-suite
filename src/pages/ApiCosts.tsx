import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { DollarSign, Zap, BarChart2, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";

interface CostLog {
  task_name: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  input_cost_usd: number;
  output_cost_usd: number;
  total_cost_usd: number; 
  created_at: string;
}

interface CostLogsResponse {
  logs: CostLog[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  grand_total_cost_usd: number;
}

const LIMIT = 10;

function fmt(n: number) {
  return `$${n.toFixed(4)}`;
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export default function ApiCosts() {
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching, refetch } = useQuery<CostLogsResponse>({
    queryKey: ["cost-logs", page],
    queryFn: () =>
      apiClient.get(`/cost-logs?page=${page}&limit=${LIMIT}`).then((r) => r.data),
    staleTime: 30_000,
  });

  const totalPages = data?.total_pages ?? 1;
  const grandTotal = data?.grand_total_cost_usd ?? 0;
  const totalCalls = data?.total ?? 0;
  const avgCost = totalCalls > 0 ? grandTotal / totalCalls : 0;

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">API Cost Tracker</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            GPT-5 usage costs — $2.50 / 1M input · $10.00 / 1M output
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground hover:bg-muted/80 disabled:opacity-50 transition-colors border border-border"
        >
          <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          icon={<DollarSign size={20} className="text-emerald-500" />}
          label="Total Cost"
          value={`$${grandTotal.toFixed(4)}`}
          sub="all time"
          color="emerald"
        />
        <SummaryCard
          icon={<Zap size={20} className="text-blue-500" />}
          label="Total API Calls"
          value={totalCalls.toLocaleString()}
          sub="logged requests"
          color="blue"
        />
        <SummaryCard
          icon={<BarChart2 size={20} className="text-purple-500" />}
          label="Avg Cost / Call"
          value={`$${avgCost.toFixed(4)}`}
          sub="per request"
          color="purple"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">#</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Timestamp</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Task</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Model</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">In Tokens</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Out Tokens</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total Tokens</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Input Cost</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Output Cost</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground pr-5">Total Cost</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-muted-foreground">
                    Loading...
                  </td>
                </tr>
              )}
              {!isLoading && (!data?.logs || data.logs.length === 0) && (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-muted-foreground">
                    No API calls logged yet. Make an AI request to see costs here.
                  </td>
                </tr>
              )}
              {!isLoading &&
                data?.logs.map((log, i) => {
                  const rowNum = (page - 1) * LIMIT + i + 1;
                  return (
                    <tr
                      key={i}
                      className="border-b border-border hover:bg-muted/40 transition-colors"
                    >
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">{rowNum}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap tabular-nums">
                        {fmtTime(log.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-md bg-blue-100 dark:bg-blue-950/60 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300 ring-1 ring-blue-300 dark:ring-blue-800/50">
                          {log.task_name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-md bg-purple-100 dark:bg-purple-950/60 px-2 py-0.5 text-xs font-medium text-purple-700 dark:text-purple-300 ring-1 ring-purple-300 dark:ring-purple-800/50">
                          {log.model}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">
                        {log.prompt_tokens.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">
                        {log.completion_tokens.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">
                        {log.total_tokens.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {fmt(log.input_cost_usd)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {fmt(log.output_cost_usd)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400 pr-5">
                        {fmt(log.total_cost_usd)}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <p className="text-xs text-muted-foreground">
              Page {page} of {totalPages} &nbsp;·&nbsp; {totalCalls} total records
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                const pageNum = getPageNumber(i, page, totalPages);
                return pageNum === -1 ? (
                  <span key={i} className="px-1 text-muted-foreground">
                    …
                  </span>
                ) : (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`min-w-[32px] rounded-md px-2 py-1 text-xs transition-colors ${
                      pageNum === page
                        ? "bg-blue-600 text-white font-medium"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: "emerald" | "blue" | "purple";
}) {
  const ring: Record<string, string> = {
    emerald: "ring-emerald-300 dark:ring-emerald-800/40",
    blue: "ring-blue-300 dark:ring-blue-800/40",
    purple: "ring-purple-300 dark:ring-purple-800/40",
  };
  const bg: Record<string, string> = {
    emerald: "bg-emerald-50 dark:bg-emerald-950/40",
    blue: "bg-blue-50 dark:bg-blue-950/40",
    purple: "bg-purple-50 dark:bg-purple-950/40",
  };
  return (
    <div className={`rounded-xl p-5 ring-1 ${ring[color]} ${bg[color]}`}>
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className="text-3xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function getPageNumber(index: number, current: number, total: number): number {
  if (total <= 7) return index + 1;
  const pages = [];
  if (current <= 4) {
    pages.push(1, 2, 3, 4, 5, -1, total);
  } else if (current >= total - 3) {
    pages.push(1, -1, total - 4, total - 3, total - 2, total - 1, total);
  } else {
    pages.push(1, -1, current - 1, current, current + 1, -1, total);
  }
  return pages[index] ?? -1;
}
