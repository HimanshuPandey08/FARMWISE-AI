
"use client";

import { Suspense, useSyncExternalStore, useState, useEffect } from "react";
import ProtectedPage from "@/components/ProtectedPage";
import Link from "next/link";
import { useParams } from "next/navigation";

const STORAGE_KEY = "farmwise-current-report";

function subscribeToReport(callback) {
  window.addEventListener("storage", callback);
  window.addEventListener("farmwise-report-updated", callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("farmwise-report-updated", callback);
  };
}

function getReportSnapshot() {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot() {
  return null;
}

function SiteHeader() {
  return (
    <header className="border-b border-gray-100 bg-white">
      <div className="mx-auto flex min-h-[66px] max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-green-900 text-2xl text-lime-400">
            🌱
          </span>
          <span className="text-base font-bold tracking-tight text-gray-950">
            FarmWise AI
          </span>
        </Link>

        <nav className="flex items-center gap-4 text-xs font-medium text-gray-800 sm:gap-9 sm:text-sm">
          <Link href="/" className="transition hover:text-green-700">
            Home
          </Link>
          <Link href="/#about" className="transition hover:text-green-700">
            About
          </Link>
          <Link href="/#contact" className="transition hover:text-green-700">
            Contact
          </Link>
        </nav>
      </div>
    </header>
  );
}

function PlantMark() {
  return (
    <svg
      viewBox="0 0 100 100"
      className="h-16 w-16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M50 72V43"
        stroke="#276000"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M47 52C26 53 22 39 24 27C39 28 50 36 47 52Z"
        fill="#438B08"
      />
      <path
        d="M53 44C53 25 66 20 80 22C80 39 68 48 53 44Z"
        fill="#276000"
      />
      <path
        d="M49 72C35 72 30 62 31 52C44 52 51 60 49 72Z"
        fill="#5A9E1B"
      />
      <path
        d="M52 72C52 60 60 53 72 54C72 66 63 73 52 72Z"
        fill="#347600"
      />
      <path
        d="M40 82H61"
        stroke="#276000"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GrowingPlantLoader({ message = "Retrieving your saved diagnosis..." }) {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      <SiteHeader />

      <section
        className="flex min-h-[calc(100vh-67px)] flex-col items-center justify-center overflow-hidden px-5 py-12 text-center"
        role="status"
        aria-live="polite"
      >
        <div className="relative flex h-36 w-36 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-full bg-green-100/50 [animation-duration:3s]" />

          <div className="absolute inset-2 rounded-full border border-green-200" />

          <div className="absolute inset-0 animate-[spin_12s_linear_infinite] rounded-full border-2 border-transparent border-t-green-700 border-r-lime-300" />

          <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-[#d1e1b4] shadow-inner">
            <div className="animate-[plant-breathe_2.4s_ease-in-out_infinite]">
              <PlantMark />
            </div>
          </div>

          <span className="absolute -right-1 top-6 h-3 w-3 animate-pulse rounded-full bg-lime-500" />
          <span className="absolute bottom-4 -left-1 h-2.5 w-2.5 animate-pulse rounded-full bg-green-700 [animation-delay:500ms]" />
        </div>

        <p className="mt-8 text-xs font-bold uppercase tracking-[0.22em] text-green-800">
          FarmWise AI
        </p>

        <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-gray-950 sm:text-3xl">
          Growing your insights...
        </h1>

        <p className="mt-3 max-w-md text-sm leading-6 text-gray-600">
          {message}
        </p>

        <div className="mt-8 flex items-center justify-center gap-3" aria-hidden="true">
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className="h-3.5 w-3.5 animate-bounce rounded-full bg-green-800"
              style={{ animationDelay: `${dot * 180}ms` }}
            />
          ))}
        </div>

        <div className="mt-8 h-1.5 w-48 overflow-hidden rounded-full bg-green-100">
          <div className="h-full w-1/3 animate-[loader-progress_1.8s_ease-in-out_infinite] rounded-full bg-green-700" />
        </div>

        <p className="mt-4 text-xs text-gray-400">
          Preparing your crop report
        </p>
      </section>

      <style jsx>{`
        @keyframes plant-breathe {
          0%, 100% {
            transform: translateY(0) scale(1);
          }
          50% {
            transform: translateY(-4px) scale(1.06);
          }
        }

        @keyframes loader-progress {
          0% {
            transform: translateX(-110%);
          }
          100% {
            transform: translateX(320%);
          }
        }
      `}</style>
    </main>
  );
}

function formatBudget(budget) {
  if (budget === null || budget === undefined || budget === "") {
    return "Not specified";
  }

  const amount = Number(budget);

  return Number.isFinite(amount)
    ? `₹${amount.toLocaleString("en-IN")}`
    : "Not specified";
}

function getPrimaryFinding(diagnosis) {
  const diseases = Array.isArray(diagnosis?.diseases)
    ? diagnosis.diseases
    : [];

  if (diseases.length > 0) {
    return diseases[0];
  }

  return null;
}

function getPredictionBadge(disease) {
  if (!disease) {
    return {
      label: "No prediction returned",
      classes: "bg-gray-100 text-gray-700",
    };
  }

  const name = String(disease.name || "").toLowerCase();

  if (
    name.includes("healthy") ||
    name.includes("no disease") ||
    name.includes("no diseases")
  ) {
    return {
      label: "Healthy prediction",
      classes: "bg-green-100 text-green-800",
    };
  }

  return {
    label: "Review recommended",
    classes: "bg-amber-100 text-amber-900",
  };
}

function QuickInfo({ label, value, colorClass }) {
  return (
    <div className={`min-w-0 rounded-lg px-3 py-3 ${colorClass}`}>
      <p className="text-xs font-medium text-gray-600">{label}</p>
      <p className="mt-1.5 break-words text-sm font-bold">{value || "Not specified"}</p>
    </div>
  );
}

function ReportContent() {
  const params = useParams();
  const reportId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const saved = useSyncExternalStore(
    subscribeToReport,
    getReportSnapshot,
    getServerSnapshot
  );

  const [dbReport, setDbReport] = useState(null);
  const [dbError, setDbError] = useState("");

  useEffect(() => {
    let ignore = false;

    let sessionParsed = null;

    if (saved) {
      try {
        sessionParsed = JSON.parse(saved);
      } catch {
        sessionParsed = null;
      }
    }

    const matchesSession =
      sessionParsed &&
      (sessionParsed.id === reportId ||
        sessionParsed.diagnosisId === reportId);

    if (matchesSession) {
      return () => {
        ignore = true;
      };
    }

    if (reportId && reportId !== "draft") {
      fetch(`/api/diagnoses?id=${encodeURIComponent(reportId)}`)
        .then((response) => {
          if (!response.ok) {
            throw new Error("Diagnosis not found in your records.");
          }

          return response.json();
        })
        .then((data) => {
          if (!ignore) {
            if (data?.diagnosis) {
              setDbReport({
                ...data.diagnosis,
                id: reportId,
                diagnosisId: data.diagnosis._id || reportId,
              });
            } else {
              setDbError("Diagnosis data could not be retrieved.");
            }
          }
        })
        .catch((error) => {
          if (!ignore) {
            setDbError(error.message || "Failed to load report.");
          }
        });
    }

    return () => {
      ignore = true;
    };
  }, [saved, reportId]);

  let report = null;

  if (saved) {
    try {
      const parsed = JSON.parse(saved);

      if (parsed.id === reportId || parsed.diagnosisId === reportId) {
        report = parsed;
      }
    } catch {
      // Fall back to the database report.
    }
  }

  if (!report && dbReport) {
    report = dbReport;
  }

  if (!report) {
    if (!dbError && reportId && reportId !== "draft") {
      return <GrowingPlantLoader />;
    }

    return (
      <main className="min-h-screen bg-gray-50">
        <SiteHeader />
        <div className="mx-auto max-w-2xl px-5 py-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">
            🌱
          </div>

          <h1 className="mt-5 text-2xl font-extrabold text-gray-950">
            Report unavailable
          </h1>

          <p role="alert" className="mt-3 text-sm leading-6 text-gray-600">
            {dbError ||
              "No matching report found. Please submit the diagnosis form first."}
          </p>

          <Link
            href="/diagnose"
            className="mt-6 inline-flex rounded-lg bg-green-800 px-5 py-3 text-sm font-bold text-white transition hover:bg-green-900"
          >
            Start a new diagnosis →
          </Link>
        </div>
      </main>
    );
  }

  const diagnosis = report.diagnosis;
  const diseases = Array.isArray(diagnosis?.diseases)
    ? diagnosis.diseases
    : [];

  const detectedCrop = diagnosis?.crop;
  const primaryDisease = getPrimaryFinding(diagnosis);
  const badge = getPredictionBadge(primaryDisease);

  const cropName =
    report.cropName || detectedCrop?.name || "Your crop";

  const diagnosisId = report.diagnosisId || report.id || reportId;

  const description = primaryDisease
    ? `The analysis returned a prediction of ${primaryDisease.name || "a possible crop condition"}. Review the field symptoms before choosing a treatment.`
    : "No specific disease prediction was returned. Review the crop and field conditions before deciding on treatment.";

  return (
    <main className="min-h-screen bg-[#fbfcfa] text-gray-900">
      <SiteHeader />

      <div className="mx-auto max-w-5xl px-5 py-7 sm:px-8 sm:py-9">
        <Link
          href="/diagnose"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 transition hover:text-green-800"
        >
          <span aria-hidden="true">←</span> Back
        </Link>

        <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-gray-950 sm:text-4xl">
          Crop Analysis
        </h1>

        <p className="mt-2 text-sm text-gray-500">
          Here is the diagnosis based on the crop information and image you submitted.
        </p>

        {/* Main diagnosis card */}
        <section className="mt-6 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_4px_8px_rgba(0,0,0,0.10)]">
          <div className="grid md:grid-cols-[260px_minmax(0,1fr)]">
            <div className="flex min-h-64 items-center justify-center bg-green-50 p-5">
              {report.image || report.imageData ? (
                <img
                  src={report.image || report.imageData}
                  alt={`Uploaded ${cropName} crop`}
                  className="h-56 w-full rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-56 w-full flex-col items-center justify-center rounded-xl bg-white text-green-800">
                  <PlantMark />
                  <p className="mt-2 text-xs text-gray-500">
                    Crop image unavailable
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col justify-center p-6 sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-green-800">
                Diagnosis result
              </p>

              <h2 className="mt-2 text-2xl font-extrabold leading-tight text-gray-950">
                {primaryDisease?.name ||
                  (diagnosis ? "No disease prediction" : "Diagnosis unavailable")}
              </h2>

              <p className="mt-1 text-sm font-medium text-gray-600">
                {cropName}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${badge.classes}`}
                >
                  {badge.label}
                </span>

                {typeof primaryDisease?.probability === "number" && (
                  <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700">
                    {(primaryDisease.probability * 100).toFixed(1)}% prediction probability
                  </span>
                )}
              </div>

              <p className="mt-4 max-w-xl text-sm leading-6 text-gray-600">
                {description}
              </p>
            </div>
          </div>
        </section>

        {/* Quick information */}
        <section className="mt-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-sm font-bold text-gray-900">Quick Info</h2>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <QuickInfo
              label="Crop"
              value={cropName}
              colorClass="bg-[#d7e5c5] text-green-950"
            />

            <QuickInfo
              label="Location"
              value={report.location}
              colorClass="bg-[#ffe3a0] text-amber-900"
            />

            <QuickInfo
              label="Soil type"
              value={report.soilType}
              colorClass="bg-[#e8d7d2] text-stone-800"
            />

            <QuickInfo
              label="Crop age"
              value={
                report.cropAge != null
                  ? `${report.cropAge} ${report.ageUnit || "days"}`
                  : "Not specified"
              }
              colorClass="bg-[#d5e6e8] text-teal-950"
            />
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
            <span className="text-sm text-gray-500">Treatment budget</span>
            <span className="text-sm font-bold text-gray-900">
              {formatBudget(report.budget)}
            </span>
          </div>
        </section>

        {/* Other predictions */}
        {diseases.length > 1 && (
          <section className="mt-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-bold">Other predictions</h2>

            <ul className="mt-3 space-y-3">
              {diseases.slice(1).map((disease, index) => (
                <li
                  key={disease.id ?? `${disease.name}-${index}`}
                  className="flex items-center justify-between gap-4 rounded-lg border border-gray-100 p-4"
                >
                  <span className="text-sm font-semibold">
                    {disease.name}
                  </span>

                  {typeof disease.probability === "number" && (
                    <span className="shrink-0 text-xs text-gray-500">
                      {(disease.probability * 100).toFixed(1)}%
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900">
            Important advisory
          </p>
          <p className="mt-1 text-sm leading-6 text-amber-800">
            AI predictions are estimates, not confirmed diagnoses. Verify field
            symptoms and consult an agricultural expert before applying chemical
            treatments.
          </p>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            href="/diagnose"
            className="inline-flex min-h-12 items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            New Diagnosis
          </Link>

          <Link
            href={`/report/${encodeURIComponent(diagnosisId)}/action-plan`}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#8bb96e] px-6 py-3 text-sm font-bold text-green-950 transition hover:bg-[#79a95a] focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2"
          >
            View action plan <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>

      <footer className="mt-8 border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-5 py-5 text-center text-xs text-gray-500 sm:px-8">
          FarmWise AI · Helping you make informed crop-care decisions.
        </div>
      </footer>
    </main>
  );
}

export default function ReportPage() {
  return (
    <Suspense
      fallback={
        <GrowingPlantLoader message="Opening your crop report..." />
      }
    >
      <ProtectedPage>
        <ReportContent />
      </ProtectedPage>
    </Suspense>
  );
}