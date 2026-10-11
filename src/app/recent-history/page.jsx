"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";

function formatDate(dateValue) {
  if (!dateValue) return "Date unavailable";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return date.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getDiagnosisDetails(record) {
  const diseases = Array.isArray(record?.diagnosis?.diseases)
    ? record.diagnosis.diseases
    : [];

  const topDisease = diseases[0];
  const diseaseName = topDisease?.name || "";
  const normalized = diseaseName.toLowerCase();

  if (
    normalized.includes("healthy") ||
    normalized.includes("no disease") ||
    normalized.includes("no diseases")
  ) {
    return {
      name: "Healthy Plant",
      type: "healthy",
      badgeClass: "bg-green-100 text-green-900 border-green-300",
    };
  }

  if (diseaseName) {
    return {
      name: diseaseName,
      type: "risk",
      badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
      probability: typeof topDisease?.probability === "number"
        ? Math.round(topDisease.probability * 100)
        : null,
    };
  }

  return {
    name: "Analyzed Crop",
    type: "neutral",
    badgeClass: "bg-gray-100 text-gray-800 border-gray-300",
  };
}

function CropThumbnail({ record, cropName }) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = record?.image;

  if (imageUrl && !imageFailed) {
    return (
      <img
        src={imageUrl}
        alt={`${cropName} crop`}
        onError={() => setImageFailed(true)}
        className="h-16 w-16 shrink-0 rounded-xl object-cover border border-gray-200"
      />
    );
  }

  const crop = (cropName || "").toLowerCase();
  let emoji = "🌱";

  if (crop.includes("tomato")) emoji = "🍅";
  else if (crop.includes("potato")) emoji = "🥔";
  else if (crop.includes("wheat") || crop.includes("rice")) emoji = "🌾";
  else if (crop.includes("corn") || crop.includes("maize")) emoji = "🌽";
  else if (crop.includes("apple")) emoji = "🍎";
  else if (crop.includes("grape")) emoji = "🍇";
  else if (crop.includes("chilli") || crop.includes("pepper")) emoji = "🌶️";

  return (
    <div
      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-green-50 border border-green-200 text-3xl"
      aria-label={`${cropName} thumbnail`}
    >
      {emoji}
    </div>
  );
}

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

        <nav className="flex items-center gap-4 text-xs font-medium text-gray-800 sm:gap-8 sm:text-sm">
          <Link href="/" className="transition hover:text-green-700">
            Home
          </Link>
          <Link href="/diagnose" className="transition hover:text-green-700">
            Diagnose
          </Link>
          <Link
            href="/recent-history"
            className="font-semibold text-green-700 underline underline-offset-4"
          >
            History
          </Link>
          <LogoutButton className="text-xs font-semibold text-gray-600 hover:text-red-700" />
        </nav>
      </div>
    </header>
  );
}

export default function RecentHistoryPage() {
  const [diagnoses, setDiagnoses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isLoggedOut, setIsLoggedOut] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let ignore = false;

    async function fetchHistory() {
      try {
        const response = await fetch("/api/diagnoses", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
        });

        if (response.status === 401) {
          if (!ignore) {
            setIsLoggedOut(true);
            setDiagnoses([]);
            setError("");
            setLoading(false);
          }
          return;
        }

        if (!response.ok) {
          throw new Error("Unable to retrieve diagnosis records. Please try again.");
        }

        const data = await response.json().catch(() => null);
        if (!ignore) {
          setDiagnoses(Array.isArray(data?.diagnoses) ? data.diagnoses : []);
          setError("");
          setIsLoggedOut(false);
          setLoading(false);
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load history.");
          setLoading(false);
        }
      }
    }

    fetchHistory();

    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  const handleRetry = () => {
    setError("");
    setIsLoggedOut(false);
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  const filteredDiagnoses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return diagnoses;

    return diagnoses.filter((item) => {
      const crop = (item.cropName || item.diagnosis?.crop?.name || "").toLowerCase();
      const location = (item.location || "").toLowerCase();
      const diseaseList = Array.isArray(item.diagnosis?.diseases)
        ? item.diagnosis.diseases.map((d) => (d.name || "").toLowerCase()).join(" ")
        : "";

      return (
        crop.includes(query) ||
        location.includes(query) ||
        diseaseList.includes(query)
      );
    });
  }, [diagnoses, searchQuery]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <SiteHeader />

      <main className="flex-1 mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
        {/* Page Title & Action Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Diagnosis History
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Review past visual health scans, disease screenings, and agronomic action plans.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/diagnose"
              className="inline-flex items-center gap-2 rounded-xl bg-green-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2"
            >
              <span>+</span>
              <span>New Diagnosis</span>
            </Link>
          </div>
        </div>

        {/* Content Container */}
        <div className="mt-8">
          {/* 1. Logged Out State */}
          {isLoggedOut ? (
            <div className="mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
              <div className="text-4xl mb-3" aria-hidden="true">
                🔒
              </div>
              <h2 className="text-lg font-bold text-gray-900">
                Log In to View Your History
              </h2>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                Your diagnosis history is private and protected. Please sign in to access your previous crop health records.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <Link
                  href="/login"
                  className="rounded-lg bg-green-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-800"
                >
                  Log In
                </Link>
                <Link
                  href="/register"
                  className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  Create Account
                </Link>
              </div>
            </div>
          ) : loading ? (
            /* 2. Loading State (Skeletons) */
            <div className="space-y-6">
              <div className="h-10 w-full max-w-sm rounded-lg bg-gray-200 animate-pulse" />
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((idx) => (
                  <div
                    key={idx}
                    className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm animate-pulse"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-16 w-16 rounded-xl bg-gray-200 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-28 rounded bg-gray-200" />
                        <div className="h-3 w-20 rounded bg-gray-100" />
                      </div>
                    </div>
                    <div className="h-6 w-32 rounded-full bg-gray-100" />
                    <div className="mt-auto h-9 w-full rounded-lg bg-gray-200" />
                  </div>
                ))}
              </div>
            </div>
          ) : error ? (
            /* 3. Error State with Retry */
            <div className="mx-auto max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
              <div className="text-4xl mb-3 text-red-600" aria-hidden="true">
                ⚠️
              </div>
              <h2 className="text-lg font-bold text-gray-900">
                Failed to Load Records
              </h2>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                {error}
              </p>
              <button
                type="button"
                onClick={handleRetry}
                className="mt-6 inline-flex rounded-lg bg-green-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-800"
              >
                Try Again
              </button>
            </div>
          ) : diagnoses.length === 0 ? (
            /* 4. Empty State (No records saved) */
            <div className="mx-auto max-w-md rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center shadow-sm">
              <div className="text-5xl mb-4" aria-hidden="true">
                🌱
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                No Diagnoses Yet
              </h2>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                You haven&apos;t analyzed any crops yet. Take a photograph of a plant or upload an image to receive instant diagnosis and treatment guidance.
              </p>
              <Link
                href="/diagnose"
                className="mt-6 inline-flex rounded-xl bg-green-700 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-green-800"
              >
                Start First Diagnosis →
              </Link>
            </div>
          ) : (
            /* 5. Records List & Search Filter */
            <div className="space-y-6">
              {/* Search Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="relative w-full max-w-md">
                  <span
                    className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400"
                    aria-hidden="true"
                  >
                    🔍
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by crop, disease, or location..."
                    className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <p className="text-xs font-medium text-gray-500">
                  Showing {filteredDiagnoses.length} of {diagnoses.length} record{diagnoses.length === 1 ? "" : "s"}
                </p>
              </div>

              {filteredDiagnoses.length === 0 ? (
                /* No search results */
                <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
                  <p className="text-sm font-medium text-gray-700">
                    No diagnosis records match &ldquo;{searchQuery}&rdquo;.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="mt-3 text-xs font-semibold text-green-700 hover:underline"
                  >
                    Clear search filter
                  </button>
                </div>
              ) : (
                /* Cards Grid */
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredDiagnoses.map((record) => {
                    const recordId = record._id;
                    const cropName =
                      record.cropName ||
                      record.diagnosis?.crop?.name ||
                      "Crop";
                    const details = getDiagnosisDetails(record);
                    const formattedDate = formatDate(record.createdAt);

                    return (
                      <article
                        key={recordId}
                        className="flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
                      >
                        <div>
                          {/* Card Header: Thumbnail, Crop, Date */}
                          <div className="flex items-start gap-4">
                            <CropThumbnail
                              record={record}
                              cropName={cropName}
                            />
                            <div className="min-w-0 flex-1">
                              <h2 className="truncate text-base font-bold text-gray-950">
                                {cropName}
                              </h2>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {formattedDate}
                              </p>
                              {record.location && (
                                <p className="truncate text-xs text-gray-600 mt-1 flex items-center gap-1">
                                  <span aria-hidden="true">📍</span>
                                  <span>{record.location}</span>
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Diagnosis Status Badge */}
                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${details.badgeClass}`}
                            >
                              {details.name}
                            </span>
                            {typeof details.probability === "number" && (
                              <span className="text-xs text-gray-500 font-medium">
                                ({details.probability}% confidence)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Card Footer: View Report Button */}
                        <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
                          <Link
                            href={`/report/${encodeURIComponent(recordId)}`}
                            className="inline-flex w-full items-center justify-center rounded-lg bg-green-50 px-4 py-2 text-xs font-semibold text-green-800 border border-green-200 transition hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2"
                          >
                            View Report →
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
