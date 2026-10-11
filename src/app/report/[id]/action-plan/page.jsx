
"use client";

import { useCallback, useEffect, useState } from "react";
import ProtectedPage from "@/components/ProtectedPage";
import Link from "next/link";
import { useParams } from "next/navigation";

const STORAGE_KEY = "farmwise-current-report";

function SiteHeader() {
  return (
    <header className="border-b border-gray-100 bg-white">
      <div className="mx-auto flex min-h-[66px] max-w-5xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-green-900 text-2xl text-lime-400">
            🌱
          </span>
          <span className="text-base font-bold text-gray-950">
            FarmWise AI
          </span>
        </Link>

        <nav className="flex items-center gap-4 text-xs font-medium text-gray-800 sm:gap-9 sm:text-sm">
          <Link href="/" className="hover:text-green-700">Home</Link>
          <Link href="/#about" className="hover:text-green-700">About</Link>
          <Link href="/#contact" className="hover:text-green-700">Contact</Link>
        </nav>
      </div>
    </header>
  );
}

function PlantIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 21v-9" />
      <path d="M12 14C4 14 3 8 4 4c6 0 10 3 8 10Z" />
      <path d="M12 11c0-6 4-8 9-8 0 6-3 10-9 10" />
    </svg>
  );
}

function PageLoader({ message = "Preparing your personalized crop-care guidance..." }) {
  return (
    <main className="min-h-screen bg-white">
      <SiteHeader />

      <section
        role="status"
        aria-live="polite"
        className="flex min-h-[calc(100vh-66px)] flex-col items-center justify-center px-5 py-12 text-center"
      >
        <div className="relative flex h-28 w-28 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-full bg-green-100/60 [animation-duration:3s]" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-green-700 border-r-lime-400" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-[#d1e1b4] text-green-800">
            <PlantIcon className="h-12 w-12 animate-[plant-grow_2s_ease-in-out_infinite]" />
          </div>
        </div>

        <h1 className="mt-7 text-2xl font-extrabold text-gray-950">
          Growing your action plan...
        </h1>

        <p className="mt-3 max-w-md text-sm leading-6 text-gray-600">
          {message}
        </p>

        <div className="mt-7 flex gap-3" aria-hidden="true">
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className="h-3 w-3 animate-bounce rounded-full bg-green-800"
              style={{ animationDelay: `${dot * 180}ms` }}
            />
          ))}
        </div>
      </section>

      <style jsx>{`
        @keyframes plant-grow {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-3px) scale(1.08); }
        }
      `}</style>
    </main>
  );
}

function PanelHeading({ icon, title, color }) {
  return (
    <h2 className={`flex items-center gap-3 text-base font-extrabold ${color}`}>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-current/10">
        {icon}
      </span>
      {title}
    </h2>
  );
}

function AdvicePanel({ type, items }) {
  const isPositive = type === "positive";
  const title = isPositive ? "What to do" : "What to avoid";
  const Icon = isPositive ? "✓" : "×";

  const colors = isPositive
    ? "border-[#dcefa8] bg-[#efffc8] text-[#285a16]"
    : "border-[#e4b2b2] bg-[#dfa5a5] text-[#a9152c]";

  const listColor = isPositive ? "text-green-700" : "text-red-600";

  return (
    <section className={`rounded-2xl border p-5 shadow-[0_2px_3px_rgba(0,0,0,0.16)] sm:px-7 sm:py-6 ${colors}`}>
      <PanelHeading icon={Icon} title={title} color={isPositive ? "text-[#285a16]" : "text-[#a9152c]"} />

      {items.length > 0 ? (
        <ul className="mt-4 space-y-3 pl-1 sm:pl-2">
          {items.map((item, index) => (
            <li
              key={`${index}-${item}`}
              className="flex items-start gap-3 text-sm leading-6 text-gray-900"
            >
              <span className={`mt-0.5 shrink-0 font-bold ${listColor}`}>
                {Icon}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 pl-1 text-sm leading-6 text-gray-700">
          {isPositive
            ? "No specific actions were returned. Review the crop symptoms with an agricultural expert."
            : "No specific cautions were returned. Avoid unverified treatments and follow approved product labels."}
        </p>
      )}
    </section>
  );
}

function SummaryCard({ title, value, detail, valueClass = "text-gray-700" }) {
  return (
    <section className="flex min-h-[105px] flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white px-3 py-4 text-center shadow-[0_2px_4px_rgba(0,0,0,0.14)]">
      <h3 className="text-sm font-extrabold text-gray-950">{title}</h3>
      <p className={`mt-2 text-sm font-medium ${valueClass}`}>{value}</p>
      {detail && (
        <p className="mt-1 text-xs leading-5 text-gray-500">{detail}</p>
      )}
    </section>
  );
}

function ActionPlanContent() {
  const params = useParams();
  const reportId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [sessionReport] = useState(() => {
    if (typeof window === "undefined") return null;

    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const cropInfo = sessionReport
    ? {
        cropName: sessionReport.cropName,
        cropAge: sessionReport.cropAge,
        ageUnit: sessionReport.ageUnit,
        location: sessionReport.location,
        budget: sessionReport.budget,
        soilType: sessionReport.soilType,
      }
    : null;

  const resolvedDiagnosisId =
    reportId && reportId !== "draft"
      ? reportId
      : sessionReport?.diagnosisId || null;

  const [consultation, setConsultation] = useState(null);
  const [weatherContext, setWeatherContext] = useState(null);
  const [evidenceSources, setEvidenceSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!resolvedDiagnosisId) {
    //   setLoading(false);
      return;
    }

    let ignore = false;

    async function loadPlan() {
      setLoading(true);
      setError("");

      try {
        const getResponse = await fetch(
          `/api/recommendations?diagnosisId=${encodeURIComponent(resolvedDiagnosisId)}`
        );

        if (getResponse.ok) {
          const existing = await getResponse.json();

          if (existing?.consultation) {
            if (!ignore) {
              setConsultation(existing.consultation);
              setWeatherContext(existing.weatherContext || null);
              setEvidenceSources(existing.evidenceSources || []);
              setLoading(false);
            }
            return;
          }
        }

        const postResponse = await fetch("/api/recommendations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            diagnosisId: resolvedDiagnosisId,
            regenerate: false,
          }),
        });

        const result = await postResponse.json().catch(() => null);

        if (!postResponse.ok) {
          throw new Error(
            result?.error || "Could not generate the treatment action plan."
          );
        }

        if (!result?.consultation) {
          throw new Error("No action plan was returned by the server.");
        }

        if (!ignore) {
          setConsultation(result.consultation);
          setWeatherContext(result.weatherContext || null);
          setEvidenceSources(result.evidenceSources || []);
        }
      } catch (err) {
        if (!ignore) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load the treatment plan."
          );
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadPlan();

    return () => {
      ignore = true;
    };
  }, [resolvedDiagnosisId, reloadKey]);

  const handleRetry = useCallback(() => {
    if (!resolvedDiagnosisId || loading || regenerating) return;
    setError("");
    setLoading(true);
    setReloadKey((previous) => previous + 1);
  }, [resolvedDiagnosisId, loading, regenerating]);

  const handleRegenerate = useCallback(async () => {
    if (!resolvedDiagnosisId || regenerating || loading) return;

    setRegenerating(true);
    setError("");

    try {
      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diagnosisId: resolvedDiagnosisId,
          regenerate: true,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || "Failed to refresh the action plan.");
      }

      if (result?.consultation) {
        setConsultation(result.consultation);
        setWeatherContext(result.weatherContext || null);
        setEvidenceSources(result.evidenceSources || []);
      } else {
        throw new Error("The server did not return an updated action plan.");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not refresh the plan."
      );
    } finally {
      setRegenerating(false);
    }
  }, [resolvedDiagnosisId, regenerating, loading]);

  if (!resolvedDiagnosisId) {
    return (
      <main className="min-h-screen bg-white">
        <SiteHeader />
        <div className="mx-auto max-w-2xl px-5 py-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-800">
            <PlantIcon className="h-9 w-9" />
          </div>
          <h1 className="mt-5 text-2xl font-extrabold text-gray-950">
            Diagnosis reference required
          </h1>
          <p className="mt-3 text-sm leading-6 text-gray-600">
            No active diagnosis record was found. Please submit a crop
            photograph and farm details first.
          </p>
          <Link
            href="/diagnose"
            className="mt-6 inline-flex rounded-lg bg-green-800 px-5 py-3 text-sm font-bold text-white hover:bg-green-900"
          >
            Start new diagnosis →
          </Link>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <PageLoader message="Retrieving agricultural guidance and preparing recommendations for your crop." />
    );
  }

  if (error || !consultation) {
    return (
      <main className="min-h-screen bg-white">
        <SiteHeader />
        <div className="mx-auto max-w-2xl px-5 py-12">
          <div className="rounded-2xl border border-red-200 bg-white p-7 shadow-sm">
            <h1 className="text-2xl font-extrabold text-gray-950">
              Unable to load action plan
            </h1>
            <p role="alert" className="mt-3 text-sm leading-6 text-red-700">
              {error || "Could not retrieve recommendations."}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleRetry}
                disabled={loading || regenerating}
                className="rounded-lg bg-green-800 px-5 py-3 text-sm font-bold text-white hover:bg-green-900 disabled:opacity-50"
              >
                Retry
              </button>

              <Link
                href={`/report/${encodeURIComponent(reportId || resolvedDiagnosisId)}`}
                className="rounded-lg border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Back to report
              </Link>

              <Link
                href="/diagnose"
                className="rounded-lg border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                New diagnosis
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const { summary, diagnosis, weather, actionPlan, reasoning } = consultation;

  const actions = Array.isArray(actionPlan?.whatToDo)
    ? actionPlan.whatToDo
    : [];

  const cautions = Array.isArray(actionPlan?.whatToAvoid)
    ? actionPlan.whatToAvoid
    : [];

  const sources =
    evidenceSources.length > 0
      ? evidenceSources
      : Array.isArray(consultation.sources)
        ? consultation.sources
        : [];

  const cost = actionPlan?.estimatedCost;
  const costValue =
    typeof cost?.amount === "number"
      ? `${cost.currency === "INR" || !cost.currency ? "₹" : `${cost.currency} `}${cost.amount.toLocaleString("en-IN")}`
      : "Variable";

  const risk = actionPlan?.riskIfUntreated || "Follow up as recommended";
  const checkDays = actionPlan?.checkAgainInDays ?? 5;

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <SiteHeader />

      <div className="mx-auto max-w-5xl px-5 py-7 sm:px-8 sm:py-9">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/report/${encodeURIComponent(reportId || resolvedDiagnosisId)}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 transition hover:text-green-800"
          >
            <span aria-hidden="true">←</span> Back
          </Link>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={regenerating || loading}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              {regenerating ? "Refreshing..." : "↻ Refresh plan"}
            </button>
          </div>
        </div>

        <div className="mt-7">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-green-800">
            Personalized crop care
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-950 sm:text-4xl">
            Your Action Plan
          </h1>

          <p className="mt-2 text-sm leading-6 text-gray-600">
            {cropInfo?.cropName ? `${cropInfo.cropName} · ` : ""}
            {diagnosis?.diseaseName || "Crop treatment guidance"}
            {cropInfo?.location ? ` · ${cropInfo.location}` : ""}
          </p>
        </div>

        {error && (
          <div role="alert" className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {error}
          </div>
        )}

        {/* Recommended actions */}
        <div className="mt-6 space-y-5">
          <AdvicePanel type="positive" items={actions} />
          <AdvicePanel type="negative" items={cautions} />
        </div>

        {/* Cost, risk and follow-up */}
        <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
          <SummaryCard
            title="Estimated Cost"
            value={costValue}
            detail={cost?.basis || "Actual cost may vary by location"}
            valueClass="text-gray-700"
          />

          <SummaryCard
            title="Risk if untreated"
            value={risk}
            valueClass="text-amber-700"
          />

          <SummaryCard
            title="Check again"
            value={`In ${checkDays} days`}
            detail="Review crop symptoms"
            valueClass="text-gray-700"
          />
        </div>

        {/* Why this advice */}
        <section className="mt-7 rounded-2xl border border-gray-100 bg-[#fafafa] p-5 shadow-[0_2px_4px_rgba(0,0,0,0.12)] sm:px-7 sm:py-6">
          <h2 className="flex items-center gap-3 text-base font-extrabold text-gray-900">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-400 text-xs text-gray-600">
              i
            </span>
            Why this advice?
          </h2>

          <p className="mt-3 text-sm leading-6 text-gray-700 sm:pl-9">
            {summary ||
              "Recommendations consider the crop diagnosis and available agricultural guidance."}
          </p>

          {Array.isArray(reasoning) && reasoning.length > 0 && (
            <ul className="mt-4 space-y-2 sm:pl-9">
              {reasoning.map((item, index) => (
                <li
                  key={`${index}-${item}`}
                  className="flex items-start gap-2 text-sm leading-6 text-gray-700"
                >
                  <span className="text-green-700">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}

          {cropInfo && (
            <p className="mt-4 text-xs leading-5 text-gray-500 sm:pl-9">
              Farm details considered: {cropInfo.cropName || "Crop not specified"}
              {cropInfo.cropAge != null
                ? `, ${cropInfo.cropAge} ${cropInfo.ageUnit || "days"} old`
                : ""}
              {cropInfo.soilType ? `, ${cropInfo.soilType} soil` : ""}
              {cropInfo.location ? `, ${cropInfo.location}` : ""}.
            </p>
          )}
        </section>

        {/* Weather intelligence, when available */}
        {weather?.available && (
          <section className="mt-6 rounded-2xl border border-blue-100 bg-blue-50/60 p-5 sm:p-6">
            <h2 className="text-base font-extrabold text-blue-950">
              Local Weather & Spray Conditions
            </h2>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Temperature", `${weather.temperatureC ?? "N/A"}°C`],
                ["Humidity", `${weather.humidityPercent ?? "N/A"}%`],
                ["24h rain", `${weather.precipitationForecastMm ?? 0} mm`],
                ["Wind speed", `${weather.windSpeedKmh ?? "N/A"} km/h`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-blue-100 bg-white p-3">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="mt-1 text-base font-bold text-gray-900">{value}</p>
                </div>
              ))}
            </div>

            {weather.sprayAdvisory && (
              <p className="mt-4 rounded-lg border border-blue-100 bg-white p-3 text-sm leading-6 text-blue-900">
                <strong>Weather note:</strong> {weather.sprayAdvisory}
              </p>
            )}
          </section>
        )}

        {/* Agricultural references */}
        <section className="mt-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-base font-extrabold text-gray-950">
            Agricultural Sources
          </h2>

          {sources.length > 0 ? (
            <ul className="mt-3 divide-y divide-gray-100">
              {sources.map((source, index) => (
                <li key={`${source.url || source.title || "source"}-${index}`} className="py-3 first:pt-0 last:pb-0">
                  {source.url ? (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-green-800 hover:underline"
                    >
                      {source.title || source.url} ↗
                    </a>
                  ) : (
                    <p className="text-sm font-semibold text-gray-800">
                      {source.title || "Agricultural reference"}
                    </p>
                  )}

                  {source.publisher && (
                    <p className="mt-1 text-xs text-gray-500">{source.publisher}</p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm leading-6 text-gray-600">
              No specific institutional advisory links were returned for this
              consultation. Verify treatment decisions against trusted local
              agricultural guidance.
            </p>
          )}
        </section>

        {/* Bottom navigation */}
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <Link
            href={`/report/${encodeURIComponent(reportId || resolvedDiagnosisId)}`}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            ← Back to report
          </Link>

          <Link
            href="/diagnose"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#8bb96e] px-6 py-3 text-sm font-bold text-green-950 transition hover:bg-[#79a95a]"
          >
            Analyze another crop →
          </Link>
        </div>
      </div>

      <footer className="mt-8 border-t border-gray-100 bg-white">
        <div className="mx-auto max-w-5xl px-5 py-5 text-center text-xs text-gray-500 sm:px-8">
          FarmWise AI · Helping you make informed crop-care decisions.
        </div>
      </footer>
    </main>
  );
}

export default function ActionPlanPage() {
  return (
    <ProtectedPage>
      <ActionPlanContent />
    </ProtectedPage>
  );
}
