"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";


export default function ReportPage({ params }) {
  const resolvedParams = React.use(params);
  const reportId = resolvedParams.id;

  const [report, setReport] = useState(null);
  const [error, setError] = useState("");


  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("farmwise-current-report");

      if (!saved) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setError("No report found. Please submit the diagnosis form first.");
        return;
      }

      const data = JSON.parse(saved);

      if (data.id !== reportId) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setError("This report could not be found.");
        return;
      }

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReport(data);
    } catch (err) {
      console.error(err);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError("Could not load the report.");
    }
  }, [reportId]);

  if (error) {
    return (
      <main className="min-h-screen p-6">
        <h1 className="text-2xl font-bold">Diagnosis Report</h1>

        <p role="alert" className="my-4">
          {error}
        </p>

        <Link href="/diagnose" className="underline">
          Start a new diagnosis
        </Link>
      </main>
    );
  }

  if (!report) {
    return <main className="p-6">Loading report...</main>;
  }

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
          <dt className="font-semibold">Crop</dt>
          <dd>{report.cropName}</dd>
        </div>

        <div>
          <dt className="font-semibold">Crop age</dt>
          <dd>
            {report.cropAge} {report.ageUnit}
          </dd>
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
          <dd>₹{report.budget.toLocaleString("en-IN")}</dd>
        </div>
      </dl>

      <section className="my-6 border p-4">
        <h2 className="font-semibold">Disease Diagnosis</h2>

        <p>
          Disease detection has not been connected yet. This page displays
          the submitted crop information, not an actual diagnosis.
        </p>
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
