"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";

function SiteHeader() {
  return (
    <header className="border-b border-gray-200 bg-white sticky top-0 z-20">
      <div className="mx-auto flex min-h-[66px] max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-green-900 text-2xl text-lime-400">
            🌱
          </span>
          <span className="text-base font-bold tracking-tight text-gray-950">
            FarmWise AI
          </span>
        </Link>

        <nav className="flex items-center gap-4 text-xs font-medium text-gray-800 sm:gap-7 sm:text-sm">
          <Link href="/" className="transition hover:text-green-700">
            Home
          </Link>
          <Link href="/diagnose" className="transition hover:text-green-700">
            Diagnose
          </Link>
          <Link href="/recent-history" className="transition hover:text-green-700">
            History
          </Link>
          <Link
            href="/community-intelligence"
            className="font-semibold text-green-700 underline underline-offset-4"
          >
            Community
          </Link>
          <LogoutButton className="text-xs font-semibold text-gray-600 hover:text-red-700" />
        </nav>
      </div>
    </header>
  );
}

function StatusBadge({ status }) {
  if (status === "elevated_signal") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-800 border border-red-200">
        <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
        Elevated Signal
      </span>
    );
  }
  if (status === "watch") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 border border-amber-200">
        <span className="h-2 w-2 rounded-full bg-amber-500" />
        Watch
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 border border-gray-200">
      <span className="h-2 w-2 rounded-full bg-gray-400" />
      Insufficient Data
    </span>
  );
}

function EvidenceBadge({ level }) {
  if (level === "high") {
    return (
      <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-200">
        High Evidence
      </span>
    );
  }
  if (level === "moderate") {
    return (
      <span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800 border border-blue-200">
        Moderate Evidence
      </span>
    );
  }
  return (
    <span className="rounded bg-gray-50 px-2 py-0.5 text-[11px] font-semibold text-gray-600 border border-gray-200">
      Low Evidence
    </span>
  );
}

export default function CommunityIntelligencePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [alerts, setAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(true);

  const [selectedArea, setSelectedArea] = useState("");
  const [selectedCrop, setSelectedCrop] = useState("");
  const [selectedDays, setSelectedDays] = useState(14);
  const [reloadKey, setReloadKey] = useState(0);

  const [, startTransition] = useTransition();

  // Load Community Intelligence aggregates
  useEffect(() => {
    let ignore = false;

    async function fetchIntelligence() {
      try {
        const params = new URLSearchParams();
        if (selectedArea) params.set("area", selectedArea);
        if (selectedCrop) params.set("crop", selectedCrop);
        if (selectedDays) params.set("days", selectedDays.toString());

        const res = await fetch(`/api/community-intelligence?${params.toString()}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error("Unable to fetch community intelligence.");
        }

        const json = await res.json();
        if (!ignore) {
          if (json.success) {
            setData(json);
            setError("");
          } else {
            setError(json.error || "Failed to load community intelligence.");
          }
          setLoading(false);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || "An unexpected error occurred.");
          setLoading(false);
        }
      }
    }

    fetchIntelligence();

    return () => {
      ignore = true;
    };
  }, [selectedArea, selectedCrop, selectedDays, reloadKey]);

  // Load personalized user alerts
  useEffect(() => {
    let ignore = false;

    async function fetchAlerts() {
      try {
        const res = await fetch("/api/community-alerts", {
          cache: "no-store",
        });

        if (!res.ok) {
          // If unauthorized (401), user is simply not logged in; silently ignore
          if (!ignore) {
            setAlerts([]);
            setAlertsLoading(false);
          }
          return;
        }

        const json = await res.json();
        if (!ignore) {
          if (json.success && Array.isArray(json.alerts)) {
            setAlerts(json.alerts);
          }
          setAlertsLoading(false);
        }
      } catch {
        if (!ignore) {
          setAlertsLoading(false);
        }
      }
    }

    fetchAlerts();

    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  // Handler to mark alert as read
  async function handleMarkAlertRead(alertId) {
    try {
      const res = await fetch(`/api/community-alerts/${encodeURIComponent(alertId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read" }),
      });
      if (res.ok) {
        startTransition(() => {
          setAlerts((prev) =>
            prev.map((a) => (a._id === alertId ? { ...a, isRead: true } : a))
          );
        });
      }
    } catch {
      // Ignore network errors on action
    }
  }

  // Handler to dismiss alert
  async function handleDismissAlert(alertId) {
    try {
      const res = await fetch(`/api/community-alerts/${encodeURIComponent(alertId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss" }),
      });
      if (res.ok) {
        startTransition(() => {
          setAlerts((prev) => prev.filter((a) => a._id !== alertId));
        });
      }
    } catch {
      // Ignore network errors on action
    }
  }

  function handleRetry() {
    setLoading(true);
    setError("");
    setReloadKey((k) => k + 1);
  }

  function handleResetFilters() {
    setLoading(true);
    setSelectedArea("");
    setSelectedCrop("");
    setSelectedDays(14);
  }

  const summary = data?.summary || {
    totalEligibleReports: 0,
    distinctAreasCount: 0,
    activeSignalsCount: 0,
    insufficientData: false,
    insufficientDataMessage: null,
    topDiseases: [],
    cropDistribution: [],
  };

  const signals = data?.signals || [];
  const filters = data?.filters || { areas: [], crops: [], timeRanges: [7, 14, 30] };

  const topDiseaseName = summary.topDiseases?.[0]?.disease || "None recorded";
  const topDiseaseCount = summary.topDiseases?.[0]?.count || 0;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <SiteHeader />

      {/* Page Header */}
      <section className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-green-100 text-sm font-bold text-green-800">
                  📡
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-green-800">
                  FarmWise Community Network
                </span>
              </div>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-950 sm:text-3xl">
                Community Disease Intelligence & Early Warnings
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">
                Aggregated, privacy-preserving crop disease patterns across farming clusters.
                Individual farm identities, exact coordinates, and personal records are never disclosed.
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
                🛡️ Privacy Safeguards Active
              </span>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        {/* Personalized Early-Warning Alerts (Authenticated Farmer) */}
        {!alertsLoading && alerts.length > 0 && (
          <section className="mb-8 rounded-2xl border border-amber-300 bg-amber-50/70 p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-amber-200">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl" aria-hidden="true">⚠️</span>
                <div>
                  <h2 className="text-base font-bold text-amber-950">
                    Location-Based Early Warnings For Your Farm
                  </h2>
                  <p className="text-xs text-amber-800">
                    Emerging disease signals detected in your geographic area for crops you cultivate.
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-amber-200/80 px-2.5 py-0.5 text-xs font-bold text-amber-900">
                {alerts.filter((a) => !a.isRead).length} Unread
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert._id}
                  className={`rounded-xl border p-4 transition ${
                    alert.isRead
                      ? "border-amber-200 bg-white/70 opacity-90"
                      : "border-amber-300 bg-white shadow-sm"
                  }`}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-gray-900 text-sm">
                          {alert.title}
                        </span>
                        <StatusBadge
                          status={
                            alert.severity === "elevated"
                              ? "elevated_signal"
                              : alert.severity === "watch"
                              ? "watch"
                              : "insufficient_data"
                          }
                        />
                        <EvidenceBadge level={alert.evidenceLevel} />
                        {!alert.isRead && (
                          <span className="rounded bg-amber-500 px-1.5 py-0.2 text-[10px] font-bold text-white uppercase">
                            New
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-xs leading-5 text-gray-700">
                        {alert.summary}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 self-end sm:self-start">
                      {!alert.isRead && (
                        <button
                          type="button"
                          onClick={() => handleMarkAlertRead(alert._id)}
                          className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                        >
                          Mark as read
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDismissAlert(alert._id)}
                        className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-500 hover:text-red-700 hover:bg-red-50 transition"
                        title="Dismiss alert"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>

                  {(alert.preventativeAction || alert.scoutingAdvice) && (
                    <div className="mt-3 grid gap-2 rounded-lg bg-amber-50/50 p-3 text-xs sm:grid-cols-2">
                      {alert.preventativeAction && (
                        <div>
                          <strong className="text-gray-900 font-semibold">Recommended Practice: </strong>
                          <span className="text-gray-700">{alert.preventativeAction}</span>
                        </div>
                      )}
                      {alert.scoutingAdvice && (
                        <div>
                          <strong className="text-gray-900 font-semibold">Field Scouting Advice: </strong>
                          <span className="text-gray-700">{alert.scoutingAdvice}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Filter Bar */}
        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
              {/* Geographic Area */}
              <div>
                <label
                  htmlFor="filter-area"
                  className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1"
                >
                  Geographic Area
                </label>
                <select
                  id="filter-area"
                  value={selectedArea}
                  onChange={(e) => {
                    setLoading(true);
                    setSelectedArea(e.target.value);
                  }}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
                >
                  <option value="">All Regions / Districts</option>
                  {filters.areas.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              {/* Crop Filter */}
              <div>
                <label
                  htmlFor="filter-crop"
                  className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1"
                >
                  Crop Type
                </label>
                <select
                  id="filter-crop"
                  value={selectedCrop}
                  onChange={(e) => {
                    setLoading(true);
                    setSelectedCrop(e.target.value);
                  }}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
                >
                  <option value="">All Crops</option>
                  {filters.crops.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Observation Window */}
              <div>
                <label
                  htmlFor="filter-days"
                  className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1"
                >
                  Time Window
                </label>
                <select
                  id="filter-days"
                  value={selectedDays}
                  onChange={(e) => {
                    setLoading(true);
                    setSelectedDays(Number(e.target.value));
                  }}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
                >
                  {filters.timeRanges.map((d) => (
                    <option key={d} value={d}>
                      Last {d} Days {d === 14 ? "(Default)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {(selectedArea || selectedCrop || selectedDays !== 14) && (
              <div className="flex shrink-0 items-end">
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="w-full sm:w-auto rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition"
                >
                  Reset Filters
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Error State */}
        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <span className="text-3xl" aria-hidden="true">⚠️</span>
            <h2 className="mt-2 text-base font-bold text-red-900">
              Unable to load community intelligence
            </h2>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <button
              type="button"
              onClick={handleRetry}
              className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-800"
            >
              Retry Connection
            </button>
          </div>
        ) : loading ? (
          /* Skeletons */
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-28 animate-pulse rounded-2xl bg-white p-5 border border-gray-200"
                />
              ))}
            </div>
            <div className="h-64 animate-pulse rounded-2xl bg-white border border-gray-200" />
          </div>
        ) : (
          <>
            {/* Key Metrics Cards */}
            <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Eligible Records
                  </span>
                  <span className="rounded-md bg-green-50 p-1.5 text-base text-green-700">
                    📋
                  </span>
                </div>
                <div className="mt-3 text-3xl font-extrabold text-gray-950">
                  {summary.totalEligibleReports}
                </div>
                <p className="mt-1 text-xs text-gray-600">
                  Crop analyses in past {selectedDays} days
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Monitored Areas
                  </span>
                  <span className="rounded-md bg-blue-50 p-1.5 text-base text-blue-700">
                    📍
                  </span>
                </div>
                <div className="mt-3 text-3xl font-extrabold text-gray-950">
                  {summary.distinctAreasCount}
                </div>
                <p className="mt-1 text-xs text-gray-600">
                  Coarse districts reporting
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Active Signals
                  </span>
                  <span className="rounded-md bg-amber-50 p-1.5 text-base text-amber-700">
                    ⚠️
                  </span>
                </div>
                <div className="mt-3 text-3xl font-extrabold text-gray-950">
                  {summary.activeSignalsCount}
                </div>
                <p className="mt-1 text-xs text-gray-600">
                  Elevated & Watch signals
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Top Disease
                  </span>
                  <span className="rounded-md bg-rose-50 p-1.5 text-base text-rose-700">
                    🔬
                  </span>
                </div>
                <div className="mt-3 truncate text-xl font-extrabold text-gray-950" title={topDiseaseName}>
                  {topDiseaseName}
                </div>
                <p className="mt-1 text-xs text-gray-600">
                  {topDiseaseCount > 0 ? `${topDiseaseCount} total instances` : "No disease detected"}
                </p>
              </div>
            </section>

            {/* Insufficient Data Notice Banner */}
            {summary.insufficientData && (
              <section className="mb-8 rounded-2xl border border-blue-200 bg-blue-50/70 p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="text-2xl" aria-hidden="true">ℹ️</span>
                  <div>
                    <h3 className="text-sm font-bold text-blue-950">
                      Community Baseline Notice
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-blue-900">
                      {summary.insufficientDataMessage ||
                        "Currently, report density in this window is below our consensus threshold. To prevent false alarms, FarmWise AI does not escalate warnings until verified by multiple independent contributors."}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* Detected Signals Section */}
            <section className="mb-10">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-950">
                    Detected Disease Signals & Emerging Patterns
                  </h2>
                  <p className="text-xs text-gray-600">
                    Aggregated by area, crop, and disease condition.
                  </p>
                </div>
                <span className="text-xs font-semibold text-gray-500">
                  {signals.length} {signals.length === 1 ? "pattern" : "patterns"} tracked
                </span>
              </div>

              {signals.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
                  <span className="text-4xl" aria-hidden="true">🌱</span>
                  <h3 className="mt-3 text-base font-bold text-gray-900">
                    No Disease Patterns Found
                  </h3>
                  <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-gray-600">
                    No active disease clusters match your current geographic and crop filters in the past {selectedDays} days.
                  </p>
                  {(selectedArea || selectedCrop) && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="mt-4 rounded-lg bg-green-800 px-4 py-2 text-xs font-semibold text-white transition hover:bg-green-900"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid gap-5 md:grid-cols-2">
                  {signals.map((s) => (
                    <div
                      key={s.id}
                      className="flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
                    >
                      <div>
                        {/* Header with badges */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-800">
                            📍 {s.area} · 🌾 {s.crop}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <StatusBadge status={s.status} />
                            <EvidenceBadge level={s.evidenceLevel} />
                          </div>
                        </div>

                        {/* Title */}
                        <h3 className="mt-3 text-lg font-bold text-gray-950">
                          {s.disease}
                        </h3>

                        {/* Explanation */}
                        <p className="mt-1 text-xs leading-5 text-gray-600">
                          {s.explanation}
                        </p>

                        {/* Quantitative / Privacy metrics */}
                        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-gray-50 p-3 text-xs">
                          <div>
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-500">
                              Verified Reports
                            </span>
                            <span className="font-extrabold text-gray-900 text-sm">
                              {s.reportCount}
                            </span>
                            {s.baselineReportCount > 0 && (
                              <span className="text-[11px] text-gray-500 ml-1">
                                (vs {s.baselineReportCount} baseline)
                              </span>
                            )}
                          </div>
                          <div>
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-500">
                              Independent Sources
                            </span>
                            <span className="font-semibold text-gray-800 text-xs">
                              {s.contributorCountDisplay}
                            </span>
                          </div>
                        </div>

                        {/* Agronomic Guidance */}
                        {s.recommendations && (
                          <div className="mt-4 space-y-2 border-t border-gray-100 pt-3 text-xs">
                            {s.recommendations.preventativeAction && (
                              <div>
                                <strong className="font-semibold text-gray-900">
                                  🛡️ Preventative Action:{" "}
                                </strong>
                                <span className="text-gray-700">
                                  {s.recommendations.preventativeAction}
                                </span>
                              </div>
                            )}
                            {s.recommendations.scoutingAdvice && (
                              <div>
                                <strong className="font-semibold text-gray-900">
                                  🔍 Scouting Routine:{" "}
                                </strong>
                                <span className="text-gray-700">
                                  {s.recommendations.scoutingAdvice}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                        <span>Observed: {new Date(s.lastObservedAt).toLocaleDateString()}</span>
                        <span className="italic">Non-prescriptive community intelligence</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Distribution Breakdown (Top Diseases & Crops) */}
            <section className="mb-10 grid gap-6 md:grid-cols-2">
              {/* Top Diseases */}
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-bold text-gray-950 uppercase tracking-wider">
                  Top Reported Pathogens
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  Most frequent conditions diagnosed across selected areas.
                </p>

                {summary.topDiseases.length === 0 ? (
                  <p className="text-xs text-gray-500 py-4 text-center">
                    No disease data recorded for this time window.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {summary.topDiseases.map((d) => {
                      const maxCount = summary.topDiseases[0]?.count || 1;
                      const percentage = Math.round((d.count / maxCount) * 100);
                      return (
                        <div key={d.disease}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-semibold text-gray-900">{d.disease}</span>
                            <span className="font-bold text-gray-600">
                              {d.count} {d.count === 1 ? "report" : "reports"}
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-green-700 transition-all duration-300"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Crop Distribution */}
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-bold text-gray-950 uppercase tracking-wider">
                  Crop Breakdown
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  Distribution of crops submitted for analysis in this period.
                </p>

                {summary.cropDistribution.length === 0 ? (
                  <p className="text-xs text-gray-500 py-4 text-center">
                    No crop data recorded for this time window.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {summary.cropDistribution.slice(0, 5).map((c) => {
                      const maxCount = summary.cropDistribution[0]?.count || 1;
                      const percentage = Math.round((c.count / maxCount) * 100);
                      return (
                        <div key={c.crop}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-semibold text-gray-900">{c.crop}</span>
                            <span className="font-bold text-gray-600">
                              {c.count} {c.count === 1 ? "report" : "reports"}
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-lime-600 transition-all duration-300"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            {/* Scientific & Community Disclaimer */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm text-xs leading-relaxed text-gray-600">
              <h4 className="font-bold text-gray-900 text-sm mb-2">
                About Community Disease Intelligence & Safety Safeguards
              </h4>
              <p>
                FarmWise AI operates with strict privacy protections. Data is grouped strictly by coarse geographic districts
                or subdistricts. Individual farm locations, names, contact numbers, and diagnosis images are never made public.
                When fewer than 3 independent farmers have reported in a cluster, exact counts are suppressed to prevent deductive identification.
              </p>
              <p className="mt-2">
                <strong>Important Notice:</strong> Signals displayed here reflect statistical patterns from user submissions and AI analysis.
                They are intended solely for situational awareness and early scouting. For confirmed pest control or chemical applications,
                always consult your local Krishi Vigyan Kendra (KVK) or State Agricultural Department extension officer.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
