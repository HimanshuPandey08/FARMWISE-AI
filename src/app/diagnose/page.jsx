

"use client";

import { useEffect, useRef, useState } from "react";
import ProtectedPage from "@/components/ProtectedPage";
import Link from "next/link";
import { useRouter } from "next/navigation";

const SOIL_TYPES = ["Sandy", "Loamy", "Clay", "Silty"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const INITIAL_FORM = {
  cropName: "",
  cropAge: "",
  ageUnit: "days",
  location: "",
  budget: "",
  soilType: "",
};

function SiteHeader() {
  return (
    <header className="border-b border-gray-100 bg-white">
      <div className="mx-auto flex min-h-[68px] max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
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
          <Link href="/recent-history" className="transition hover:text-green-700">
            History
          </Link>
          <Link href="/community-intelligence" className="transition hover:text-green-700">
            Community
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

function FieldLabel({ htmlFor, children }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-2 block text-sm font-bold text-gray-900"
    >
      {children}
    </label>
  );
}

export default function DiagnosePage() {
  const router = useRouter();

  const [form, setForm] = useState(INITIAL_FORM);
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const uploadInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
    setError("");
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      event.target.value = "";
      setError("Please select a JPG, PNG or WebP image.");
      return;
    }

    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      event.target.value = "";
      setError("Image must be larger than 0 bytes and no more than 10 MB.");
      return;
    }

    setImage(file);
    setPreview(URL.createObjectURL(file));
    setError("");

    // Clear the other input so the same file can be selected again.
    if (event.target === uploadInputRef.current && cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }

    if (event.target === cameraInputRef.current && uploadInputRef.current) {
      uploadInputRef.current.value = "";
    }
  }

  async function uploadCropImage(file) {
    const formData = new FormData();
    formData.append("image", file);

    const response = await fetch("/api/upload-image", {
      method: "POST",
      body: formData,
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(result?.error || "Image upload failed.");
    }

    if (!result?.secureUrl) {
      throw new Error("Cloudinary did not return an image URL.");
    }

    return result.secureUrl;
  }

  async function diagnoseCrop(imageUrl) {
    const response = await fetch("/api/diagnose-crop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(result?.error || "Crop diagnosis failed.");
    }

    if (!result?.success) {
      throw new Error("Crop.health did not return a successful diagnosis.");
    }

    return result;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (loading) return;

    if (!image) {
      setError("Please upload a crop photograph.");
      return;
    }

    if (!form.cropName.trim() || !form.location.trim()) {
      setError("Crop name and location are required.");
      return;
    }

    const cropAge = Number(form.cropAge);
    const budget = Number(form.budget);

    if (!form.cropAge.trim() || !Number.isFinite(cropAge) || cropAge <= 0) {
      setError("Enter a crop age greater than zero.");
      return;
    }

    if (!form.budget.trim() || !Number.isFinite(budget) || budget < 0) {
      setError("Enter a valid non-negative budget.");
      return;
    }

    if (!SOIL_TYPES.includes(form.soilType)) {
      setError("Select a valid soil type.");
      return;
    }

    setLoading(true);

    try {
      // Step 1: Upload the image to Cloudinary.
      const imageUrl = await uploadCropImage(image);

      // Step 2: Obtain real crop and disease predictions.
      const diagnosis = await diagnoseCrop(imageUrl);

      // Step 3: Save the diagnosis permanently for this farmer.
      const saveResponse = await fetch("/api/diagnoses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cropName: form.cropName.trim(),
          cropAge,
          ageUnit: form.ageUnit,
          location: form.location.trim(),
          budget,
          soilType: form.soilType,
          image: imageUrl,
          diagnosis,
        }),
      });

      const savedResult = await saveResponse.json().catch(() => null);

      if (!saveResponse.ok) {
        throw new Error(
          savedResult?.error ||
            "Diagnosis completed, but saving it to history failed."
        );
      }

      // Step 4: Keep the existing report page working.
      const report = {
        id: "draft",
        diagnosisId: savedResult.diagnosisId,
        cropName: form.cropName.trim(),
        cropAge,
        ageUnit: form.ageUnit,
        location: form.location.trim(),
        budget,
        soilType: form.soilType,
        imageName: image.name,
        image: imageUrl,
        diagnosis,
        createdAt: new Date().toISOString(),
      };

      sessionStorage.setItem(
        "farmwise-current-report",
        JSON.stringify(report)
      );

      window.dispatchEvent(new Event("farmwise-report-updated"));
      router.push("/report/draft");
    } catch (err) {
      console.error("Diagnosis submission failed:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Could not complete crop diagnosis. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setForm(INITIAL_FORM);
    setImage(null);
    setPreview("");
    setError("");

    if (uploadInputRef.current) uploadInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  return (
    <ProtectedPage>
      <main className="min-h-screen bg-white text-gray-900">
        <SiteHeader />

        <div className="mx-auto max-w-4xl px-5 py-7 sm:px-8 sm:py-9">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 transition hover:text-green-800"
          >
            <span aria-hidden="true">←</span> Back
          </Link>

          <div className="mx-auto mt-7 max-w-3xl">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-green-800">
                Personalized crop care
              </p>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-950">
                Farm Details
              </h1>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Tell us more about your farm and crop.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              {/* Crop name */}
              <div>
                <FieldLabel htmlFor="cropName">Crop</FieldLabel>
                <input
                  id="cropName"
                  name="cropName"
                  value={form.cropName}
                  onChange={handleChange}
                  required
                  maxLength={100}
                  placeholder="e.g. Tomato"
                  autoComplete="off"
                  className="h-10 w-full rounded-lg border border-lime-500 bg-white px-4 text-sm outline-none transition placeholder:text-gray-400 focus:border-green-700 focus:ring-2 focus:ring-green-100"
                />
              </div>

              {/* Crop age */}
              <div>
                <FieldLabel htmlFor="cropAge">Crop age</FieldLabel>
                <div className="flex overflow-hidden rounded-lg border border-lime-500 focus-within:ring-2 focus-within:ring-green-100">
                  <input
                    id="cropAge"
                    name="cropAge"
                    type="number"
                    min="0.01"
                    step="any"
                    value={form.cropAge}
                    onChange={handleChange}
                    required
                    placeholder="e.g. 15"
                    className="h-10 min-w-0 flex-1 bg-white px-4 text-sm outline-none"
                  />

                  <select
                    name="ageUnit"
                    value={form.ageUnit}
                    onChange={handleChange}
                    aria-label="Crop age unit"
                    className="h-10 min-w-[86px] cursor-pointer border-l border-lime-500 bg-lime-500 px-3 text-xs font-medium text-green-950 outline-none"
                  >
                    <option value="days">days</option>
                    <option value="months">months</option>
                    <option value="years">years</option>
                  </select>
                </div>
              </div>

              {/* Location */}
              <div>
                <FieldLabel htmlFor="location">Location</FieldLabel>
                <div className="flex h-11 items-center overflow-hidden rounded-lg border border-green-200 bg-white shadow-[0_2px_4px_rgba(0,0,0,0.12)] focus-within:border-green-600 focus-within:ring-2 focus-within:ring-green-100">
                  <span
                    className="pl-3 text-lg text-green-600"
                    aria-hidden="true"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="h-5 w-5"
                    >
                      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
                      <circle cx="12" cy="10" r="2.5" />
                    </svg>
                  </span>

                  <input
                    id="location"
                    name="location"
                    value={form.location}
                    onChange={handleChange}
                    required
                    maxLength={200}
                    placeholder="Village, town or district"
                    autoComplete="address-level2"
                    className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-gray-400"
                  />
                </div>
                <p className="mt-1.5 text-xs text-gray-500">
                  Enter your village, town or district.
                </p>
              </div>

              {/* Soil type */}
              <fieldset>
                <legend className="mb-2 text-sm font-bold text-gray-900">
                  Soil Type
                </legend>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {SOIL_TYPES.map((soil) => {
                    const selected = form.soilType === soil;

                    return (
                      <button
                        key={soil}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          setForm((previous) => ({
                            ...previous,
                            soilType: soil,
                          }));
                          setError("");
                        }}
                        className={`min-h-10 rounded-lg border px-3 text-sm font-medium shadow-[0_2px_4px_rgba(0,0,0,0.12)] transition focus:outline-none focus:ring-2 focus:ring-green-300 ${
                          selected
                            ? "border-green-800 bg-green-800 text-white"
                            : "border-green-100 bg-white text-gray-700 hover:border-green-500 hover:bg-green-50"
                        }`}
                      >
                        {soil}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {/* Budget */}
              <div>
                <FieldLabel htmlFor="budget">Budget</FieldLabel>
                <div className="flex h-10 items-center overflow-hidden rounded-lg border border-lime-500 focus-within:ring-2 focus-within:ring-green-100">
                  <span
                    className="pl-3 text-base"
                    aria-hidden="true"
                  >
                    💰
                  </span>
                  <span className="pl-2 text-sm text-gray-600">₹</span>
                  <input
                    id="budget"
                    name="budget"
                    type="number"
                    min="0"
                    step="1"
                    value={form.budget}
                    onChange={handleChange}
                    required
                    placeholder="10000"
                    className="h-full min-w-0 flex-1 bg-white px-2 text-sm outline-none placeholder:text-gray-400"
                  />
                </div>
              </div>

              {/* Crop image upload */}
              <section className="pt-1">
                <h2 className="text-sm font-bold text-gray-900">
                  Upload Crop Photo
                </h2>
                <p className="mt-1 text-xs leading-5 text-gray-600">
                  Take a clear photo of the affected leaf or crop.
                </p>

                <input
                  ref={uploadInputRef}
                  id="crop-image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageChange}
                  className="sr-only"
                />

                <input
                  ref={cameraInputRef}
                  id="crop-camera"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  onChange={handleImageChange}
                  className="sr-only"
                />

                <div className="mt-4 rounded-2xl border border-gray-100 bg-[#f3f3f3] px-5 py-7 shadow-[0_4px_2px_rgba(0,0,0,0.2)] sm:px-8 sm:py-9">
                  <div className="mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-gray-200 bg-white shadow-inner">
                    {preview ? (
                      <img
                        src={preview}
                        alt="Selected crop preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-4xl" aria-hidden="true">
                        🌿
                      </span>
                    )}
                  </div>

                  {image && (
                    <div className="mx-auto mt-3 max-w-sm text-center">
                      <p className="truncate text-sm font-semibold text-gray-800">
                        {image.name}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {(image.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setImage(null);
                          setPreview("");
                          setError("");
                          if (uploadInputRef.current) {
                            uploadInputRef.current.value = "";
                          }
                          if (cameraInputRef.current) {
                            cameraInputRef.current.value = "";
                          }
                        }}
                        className="mt-1 text-xs font-semibold text-red-700 hover:underline"
                      >
                        Remove photo
                      </button>
                    </div>
                  )}

                  <div className="mx-auto mt-6 grid max-w-lg grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      disabled={loading}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#5b7f24] px-4 py-3 text-sm font-bold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="h-5 w-5"
                        aria-hidden="true"
                      >
                        <path d="M9 4 7.5 6H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2.5L15 4H9Zm3 12.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" />
                      </svg>
                      Take Photo
                    </button>

                    <button
                      type="button"
                      onClick={() => uploadInputRef.current?.click()}
                      disabled={loading}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border-2 border-green-700 bg-white px-4 py-3 text-sm font-bold text-green-700 transition hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="h-5 w-5"
                        aria-hidden="true"
                      >
                        <path d="M12 3a6 6 0 0 0-5.83 4.56A4.5 4.5 0 0 0 6.5 16.5H9v-3H7l5-5 5 5h-2v3h2.5a4.5 4.5 0 0 0 .33-8.94A6 6 0 0 0 12 3Zm-1.5 10.5h3V20h-3v-6.5Z" />
                      </svg>
                      Upload Photo
                    </button>
                  </div>

                  <p className="mt-4 text-center text-[11px] leading-5 text-gray-600">
                    Supported formats: JPG, PNG, WebP
                    <span className="mx-2">|</span>
                    Max size: 10 MB
                  </p>
                </div>

                {/* Photo tips */}
                <aside className="mt-5 rounded-2xl bg-[#d8e6c4] px-5 py-4 sm:px-6">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <span className="text-lg" aria-hidden="true">
                      ☀️
                    </span>
                    Photo Tips
                  </h3>

                  <ul className="mt-2 space-y-1 pl-7 text-xs leading-5 text-gray-800">
                    <li className="list-none">
                      <span className="mr-2 text-green-700">✓</span>
                      Use good lighting, preferably natural light
                    </li>
                    <li className="list-none">
                      <span className="mr-2 text-green-700">✓</span>
                      Focus on the affected area
                    </li>
                    <li className="list-none">
                      <span className="mr-2 text-green-700">✓</span>
                      Avoid blurry or dark images
                    </li>
                  </ul>
                </aside>
              </section>

              {/* Errors */}
              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"
                >
                  {error}
                </div>
              )}

              {/* Submit */}
              <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={loading}
                  className="min-h-11 rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  Reset form
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#86a35c] px-8 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      Analyzing crop...
                    </>
                  ) : (
                    <>
                      Submit <span aria-hidden="true">→</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-center text-xs leading-5 text-gray-500">
                Your photo will be uploaded securely for crop analysis.
              </p>
            </form>
          </div>
        </div>

        <footer className="mt-8 border-t border-gray-100 bg-white">
          <div className="mx-auto max-w-4xl px-5 py-5 text-center text-xs text-gray-500 sm:px-8">
            FarmWise AI · Helping you make informed crop-care decisions.
          </div>
        </footer>
      </main>
    </ProtectedPage>
  );
}
