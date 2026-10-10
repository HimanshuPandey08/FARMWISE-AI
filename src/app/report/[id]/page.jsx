
"use client";

import { useSyncExternalStore } from "react";
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
    const saved = sessionStorage.getItem(STORAGE_KEY);
    return saved ?? null;
  } catch {
    return null;
  }
}

function getServerSnapshot() {
  return null;
}

export default function ReportPage() {
  const params = useParams();
  const reportId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const saved = useSyncExternalStore(
    subscribeToReport,
    getReportSnapshot,
    getServerSnapshot
  );

  if (saved === null) {
    return <main className="min-h-screen p-6">Loading report...</main>;
  }

  let report;

  try {
    report = JSON.parse(saved);
  } catch {
    return (
      <main className="min-h-screen p-6">
        <p role="alert">Could not load the report.</p>
        <Link href="/diagnose" className="underline">
          Start a new diagnosis
        </Link>
      </main>
    );
  }

  if (!report || report.id !== reportId) {
    return (
      <main className="min-h-screen p-6">
        <p role="alert">
          No matching report found. Please submit the diagnosis form first.
        </p>
        <Link href="/diagnose" className="underline">
          Start a new diagnosis
        </Link>
      </main>
    );
  }

  const diagnosis = report.diagnosis;
  const diseases = diagnosis?.diseases ?? [];
  const detectedCrop = diagnosis?.crop;

  return (
    <main className="min-h-screen p-6">
      <h1 className="mb-6 text-2xl font-bold">Diagnosis Report</h1>

      {(report.image || report.imageData) && (
        <img
          src={report.image || report.imageData}
          alt={`Uploaded ${report.cropName} crop`}
          className="mb-6 max-h-80 max-w-full object-contain"
        />
      )}

      <h2 className="text-xl font-semibold">Submitted Crop Details</h2>

      <dl className="my-4 space-y-3">
        <div>
          <dt className="font-semibold">Entered crop name</dt>
          <dd>{report.cropName}</dd>
        </div>
        <div>
          <dt className="font-semibold">Crop age</dt>
          <dd>{report.cropAge} {report.ageUnit}</dd>
        </div>
        <div>
          <dt className="font-semibold">Location</dt>
          <dd>{report.location}</dd>
        </div>
        <div>
          <dt className="font-semibold">Soil type</dt>
          <dd>{report.soilType}</dd>
        </div>
        <div>
          <dt className="font-semibold">Treatment budget</dt>
          <dd>₹{Number(report.budget).toLocaleString("en-IN")}</dd>
        </div>
      </dl>

      <section className="my-6 space-y-4 border p-4">
        <h2 className="text-xl font-semibold">Disease Diagnosis</h2>

        {!diagnosis ? (
          <p>No diagnosis results are saved. Please submit the form again.</p>
        ) : (
          <>
            <div>
              <h3 className="font-semibold">AI-identified crop</h3>
              <p>{detectedCrop?.name ?? "No crop identified"}</p>
              {typeof detectedCrop?.probability === "number" && (
                <p>
                  Confidence: {(detectedCrop.probability * 100).toFixed(2)}%
                </p>
              )}
            </div>

            <div>
              <h3 className="font-semibold">Disease predictions</h3>
              {diseases.length === 0 ? (
                <p>No disease predictions were returned.</p>
              ) : (
                <ol className="list-decimal space-y-3 pl-6">
                  {diseases.map((disease, index) => (
                    <li key={disease.id ?? `${disease.name}-${index}`}>
                      <p className="font-semibold">{disease.name}</p>
                      {typeof disease.probability === "number" && (
                        <p>
                          Confidence: {(disease.probability * 100).toFixed(2)}%
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <p className="text-sm text-gray-500">
              Predictions are estimates and should be verified before treatment.
            </p>
          </>
        )}
      </section>

      <Link
        href={`/report/${report.id}/action-plan`}
        className="inline-block border px-4 py-3"
      >
        View Action Plan
      </Link>

      <p className="mt-4">
        <Link href="/diagnose" className="underline">
          Start another diagnosis
        </Link>
      </p>
    </main>
  );
}
