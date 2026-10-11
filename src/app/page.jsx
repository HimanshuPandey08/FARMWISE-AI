"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";

const HERO_IMAGE =
  "https://res.cloudinary.com/bvtkcr15/image/upload/ff8df2cf704fcef8af5f8a425b4b169d1a250f8d.png";

const CURRENT_YEAR = 2026;

function formatRelativeDate(dateValue) {
  if (!dateValue) return "Date unavailable";

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  const days = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
  );

  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;

  const months = Math.floor(days / 30);

  if (months < 12) {
    return `${months} ${months === 1 ? "month" : "months"} ago`;
  }

  const years = Math.floor(days / 365);
  return `${years} ${years === 1 ? "year" : "years"} ago`;
}

function getDiagnosisDetails(record) {
  const diseases = Array.isArray(record?.diagnosis?.diseases)
    ? record.diagnosis.diseases
    : [];

  const diseaseName = diseases[0]?.name || "";
  const normalized = diseaseName.toLowerCase();

  if (
    normalized.includes("healthy") ||
    normalized.includes("no disease") ||
    normalized.includes("no diseases")
  ) {
    return { label: "Healthy", type: "healthy" };
  }

  if (diseaseName) {
    return { label: "At risk", type: "risk" };
  }

  return { label: "Analyzed", type: "neutral" };
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
        className="h-12 w-12 shrink-0 rounded-lg object-cover"
      />
    );
  }

  const crop = cropName.toLowerCase();
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
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-2xl"
      aria-label={`${cropName} thumbnail`}
    >
      {emoji}
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="relative z-20 bg-white">
      <div className="mx-auto flex min-h-[66px] max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-green-900 text-2xl text-lime-400">
            🌱
          </span>
          <span className="text-lg font-bold tracking-tight text-gray-950">
            FarmWise AI
          </span>
        </Link>

        <nav className="flex items-center gap-4 text-xs font-medium text-gray-800 sm:gap-9 sm:text-sm">
          <Link href="/" className="transition hover:text-green-700">
            Home
          </Link>

          {/* New History navigation link */}
          <Link
            href="/recent-history"
            className="transition hover:text-green-700"
          >
            History
          </Link>

          <Link
            href="/community-intelligence"
            className="transition hover:text-green-700"
          >
            Community
          </Link>

          <a href="#about" className="transition hover:text-green-700">
            About
          </a>

          <a href="#contact" className="transition hover:text-green-700">
            Contact
          </a>
        </nav>
      </div>
    </header>
  );
}

function CommunityBanner() {
  return (
    <section className="bg-gradient-to-r from-emerald-900 to-green-950 text-white border-y border-emerald-800">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-5 py-5 sm:flex-row sm:items-center sm:px-8">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-lime-400 text-2xl text-gray-950">
            📡
          </span>
          <div>
            <h2 className="text-base font-bold text-white sm:text-lg">
              Community Disease Intelligence & Early Warnings
            </h2>
            <p className="text-xs text-lime-200/90 sm:text-sm">
              Track emerging crop disease patterns and location-based advisories across farming communities.
            </p>
          </div>
        </div>

        <Link
          href="/community-intelligence"
          className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-lime-400 px-4 py-2.5 text-xs font-bold text-gray-950 shadow-sm transition hover:bg-lime-300"
        >
          View Live Intelligence <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}

function FeatureStrip() {
  const features = [
    {
      icon: "🌿",
      title: "AI-Powered",
      subtitle: "Disease Detection",
    },
    {
      icon: "▣",
      title: "Personalised",
      subtitle: "Action Plan",
    },
    {
      icon: "▤",
      title: "Trusted",
      subtitle: "Agricultural Knowledge",
    },
    {
      icon: "🌱",
      title: "Better Yield",
      subtitle: "& Healthier Crop",
    },
  ];

  return (
    <section
      id="about"
      className="border-y border-gray-200 bg-white"
      aria-label="FarmWise AI features"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-5 py-4 sm:px-8 md:grid-cols-4 md:gap-6 md:py-5">
        {features.map((feature) => (
          <div key={feature.title} className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center text-2xl text-green-700"
              aria-hidden="true"
            >
              {feature.icon}
            </span>

            <div>
              <h2 className="text-sm font-bold text-gray-900">
                {feature.title}
              </h2>
              <p className="text-xs leading-5 text-gray-600 sm:text-sm">
                {feature.subtitle}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RecentAnalysis({ diagnoses, loading, error, onRetry }) {
  const recent = diagnoses.slice(0, 3);

  return (
    <section id="recent-analysis" className="bg-[#f5fcfc]">
      <div className="mx-auto max-w-7xl px-5 py-7 sm:px-8 sm:py-9">
        <div className="mb-5 flex items-center justify-between gap-4">
          {/* The entire Recent Analysis heading is now clickable */}
          <Link
            href="/recent-history"
            className="inline-flex items-center gap-2 rounded-sm text-sm font-semibold text-gray-900 transition hover:text-green-700 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2"
          >
            Recent Analysis
            <span className="text-green-700" aria-hidden="true">
              →
            </span>
          </Link>

          {diagnoses.length > 3 && (
            <Link
              href="/recent-history"
              className="text-xs font-semibold text-green-800 hover:underline"
            >
              View all
            </Link>
          )}
        </div>

        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="flex animate-pulse items-center gap-4 rounded-2xl bg-white p-5 shadow-md"
              >
                <div className="h-12 w-12 rounded-lg bg-gray-200" />
                <div className="flex-1">
                  <div className="h-4 w-24 rounded bg-gray-200" />
                  <div className="mt-3 h-3 w-16 rounded bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-amber-200 bg-white p-5">
            <p className="text-sm text-gray-700">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 text-sm font-semibold text-green-800 hover:underline"
            >
              Try again
            </button>
          </div>
        ) : recent.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white px-5 py-9 text-center shadow-sm">
            <div className="text-4xl" aria-hidden="true">
              🌱
            </div>
            <h3 className="mt-3 font-bold text-gray-900">
              Your farm journey starts here
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
              Your saved crop analyses will appear here after your first
              diagnosis.
            </p>
            <Link
              href="/diagnose"
              className="mt-5 inline-flex rounded-lg bg-green-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-900"
            >
              Analyze your first crop →
            </Link>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((record, index) => {
              const cropName =
                record.cropName ||
                record.diagnosis?.crop?.name ||
                "Unknown crop";

              const details = getDiagnosisDetails(record);
              const recordId = record._id || record.diagnosisId;

              return (
                <Link
                  key={recordId || `${cropName}-${index}`}
                  href={
                    recordId
                      ? `/report/${encodeURIComponent(recordId)}`
                      : "/diagnose"
                  }
                  className="group flex min-h-[116px] items-center gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_5px_12px_rgba(0,0,0,0.12)] transition duration-200 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2"
                >
                  <CropThumbnail record={record} cropName={cropName} />

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-bold text-gray-950">
                      {cropName}
                    </h3>

                    <p className="mt-1 text-xs text-gray-600">
                      {formatRelativeDate(record.createdAt)}
                    </p>

                    <span
                      className={`mt-3 inline-flex max-w-full items-center justify-center rounded-full px-3 py-1 text-[11px] font-bold ${
                        details.type === "healthy"
                          ? "bg-[#cce0b7] text-green-950"
                          : details.type === "risk"
                            ? "bg-red-100 text-red-900"
                            : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {details.label}
                    </span>
                  </div>

                  <span
                    className="self-start text-gray-300 transition group-hover:text-green-700"
                    aria-hidden="true"
                  >
                    ↗
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export default function HomePage() {
  const [diagnoses, setDiagnoses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function fetchDiagnoses() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/diagnoses", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });

        if (response.status === 401) {
          setDiagnoses([]);
          setError("Log in to see your saved crop analyses.");
          return;
        }

        if (!response.ok) {
          throw new Error("Could not load your recent crop analyses.");
        }

        const data = await response.json();

        setDiagnoses(Array.isArray(data?.diagnoses) ? data.diagnoses : []);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Could not load your recent analyses.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchDiagnoses();

    return () => controller.abort();
  }, []);

  function retryLoadDiagnoses() {
    setLoading(true);
    setError("");

    fetch("/api/diagnoses", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    })
      .then((response) => {
        if (response.status === 401) {
          setDiagnoses([]);
          throw new Error("Log in to see your saved crop analyses.");
        }

        if (!response.ok) {
          throw new Error("Could not load your recent crop analyses.");
        }

        return response.json();
      })
      .then((data) => {
        setDiagnoses(Array.isArray(data?.diagnoses) ? data.diagnoses : []);
      })
      .catch((err) => {
        setError(err.message || "Could not load your recent analyses.");
      })
      .finally(() => {
        setLoading(false);
      });
  }

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <SiteHeader />

      {/* Hero */}
      <section
        className="relative isolate flex min-h-[285px] items-center overflow-hidden bg-gray-900 bg-cover bg-center sm:min-h-[330px] lg:min-h-[355px]"
        style={{ backgroundImage: `url("${HERO_IMAGE}")` }}
      >
        <div
          className="absolute inset-0 -z-10 bg-black/45"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-r from-black/55 via-black/25 to-transparent"
          aria-hidden="true"
        />

        <div className="mx-auto w-full max-w-7xl px-6 py-12 sm:px-10 md:px-14 lg:px-20">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-lime-200 sm:text-sm">
            Smarter farming starts here
          </p>

          <h1 className="text-4xl font-extrabold tracking-tight text-white drop-shadow-sm sm:text-5xl lg:text-6xl">
            FarmWise AI
          </h1>

          <p className="mt-2 text-base font-semibold text-white sm:text-lg">
            AI powered decision assistance
          </p>

          <p className="mt-3 text-xs text-white/90 sm:text-sm">
            Detect, Understand, Decide, Act
          </p>

          <Link
            href="/diagnose"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-lime-400 px-5 py-3 text-sm font-bold text-gray-950 shadow-md transition hover:bg-lime-300 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-green-900"
          >
            Analyze My Crop <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <FeatureStrip />
      <CommunityBanner />

      <RecentAnalysis
        diagnoses={diagnoses}
        loading={loading}
        error={error}
        onRetry={retryLoadDiagnoses}
      />

      <footer id="contact" className="border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 py-5 text-center sm:flex-row sm:px-8 sm:text-left">
          <p className="text-xs text-gray-500">© {CURRENT_YEAR} FarmWise AI</p>

          <div className="flex items-center gap-4">
            <Link
              href="/diagnose"
              className="text-xs font-semibold text-green-800 hover:underline"
            >
              Analyze a crop
            </Link>
            <LogoutButton />
          </div>
        </div>
      </footer>
    </main>
  );
}