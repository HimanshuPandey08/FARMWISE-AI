
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const SOIL_TYPES = ["Loamy", "Clay", "Sandy", "Silty"];
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

export default function DiagnosePage() {
  const router = useRouter();

  const [form, setForm] = useState(INITIAL_FORM);
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0];

    setImage(null);
    setPreview("");
    setError("");

    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      event.target.value = "";
      setError("Select a JPG, PNG or WebP image.");
      return;
    }

    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      event.target.value = "";
      setError("Image must be larger than 0 bytes and no more than 10 MB.");
      return;
    }

    setImage(file);
    setPreview(URL.createObjectURL(file));
  }

  async function uploadCropImage(file) {
    const formData = new FormData();
    formData.append("image", file);

    const response = await fetch("/api/upload-image", {
      method: "POST",
      body: formData,
    });

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      throw new Error(
        `Image upload returned a non-JSON response (HTTP ${response.status}).`
      );
    }

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Image upload failed.");
    }

    if (!result.secureUrl) {
      throw new Error("Cloudinary did not return an image URL.");
    }

    return result.secureUrl;
  }

  async function diagnoseCrop(imageUrl) {
    const response = await fetch("/api/diagnose-crop", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ imageUrl }),
    });

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      throw new Error(
        `Crop diagnosis returned a non-JSON response (HTTP ${response.status}).`
      );
    }

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Crop diagnosis failed.");
    }

    if (!result.success) {
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

    if (
      form.cropAge.trim() === "" ||
      !Number.isFinite(cropAge) ||
      cropAge <= 0
    ) {
      setError("Enter a crop age greater than zero.");
      return;
    }

    if (
      form.budget.trim() === "" ||
      !Number.isFinite(budget) ||
      budget < 0
    ) {
      setError("Enter a valid non-negative budget.");
      return;
    }

    if (!SOIL_TYPES.includes(form.soilType)) {
      setError("Select a valid soil type.");
      return;
    }

    setLoading(true);

    try {

    const imageUrl = await uploadCropImage(image);
    console.log("Cloudinary image URL:", imageUrl);

    const diagnosis = await diagnoseCrop(imageUrl);

    // Print the complete response.
    console.log("Crop.health full diagnosis:", diagnosis);

    // Print the detected crop.
    console.log("Detected crop:", diagnosis.crop?.name ?? "Unknown");

    // Print all disease predictions.
    if (diagnosis.diseases?.length > 0) {
    console.log("Disease predictions:");

    diagnosis.diseases.forEach((disease, index) => {
        console.log(`${index + 1}. ${disease.name}`);
        console.log(
        "Confidence:",
        `${(disease.probability * 100).toFixed(2)}%`
        );
    });
    } else {
    console.log("No disease predictions returned.");
    }


      // Step 3: Save form data and diagnosis for the report page.
      const report = {
        id: "draft",
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

        // Step 4: Navigate to the existing report page.
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

    const input = document.getElementById("crop-image");
    if (input) input.value = "";
  }

  return (
    <main className="min-h-screen p-6">
      <h1 className="mb-6 text-2xl font-bold">Crop Diagnosis</h1>

      <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
        <div>
          <label htmlFor="crop-image">Crop photograph *</label>
          <input
            id="crop-image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleImageChange}
            className="block w-full border p-2"
            required
          />
        </div>

        {preview && (
          <img
            src={preview}
            alt="Selected crop"
            className="max-h-64 max-w-full object-contain"
          />
        )}

        <div>
          <label htmlFor="cropName">Crop name *</label>
          <input
            id="cropName"
            name="cropName"
            value={form.cropName}
            onChange={handleChange}
            required
            maxLength={100}
            placeholder="e.g. Tomato"
            className="block w-full border p-2"
          />
        </div>

        <div>
          <label htmlFor="cropAge">Crop age *</label>
          <div className="flex gap-2">
            <input
              id="cropAge"
              name="cropAge"
              type="number"
              min="0.01"
              step="any"
              value={form.cropAge}
              onChange={handleChange}
              required
              placeholder="e.g. 45"
              className="w-full border p-2"
            />

            <select
              name="ageUnit"
              value={form.ageUnit}
              onChange={handleChange}
              aria-label="Crop age unit"
              className="border p-2"
            >
              <option value="days">Days</option>
              <option value="months">Months</option>
              <option value="years">Years</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="location">Farm location *</label>
          <input
            id="location"
            name="location"
            value={form.location}
            onChange={handleChange}
            required
            maxLength={200}
            placeholder="Village, town or district"
            className="block w-full border p-2"
          />
        </div>

        <div>
          <label htmlFor="budget">Treatment budget (₹) *</label>
          <input
            id="budget"
            name="budget"
            type="number"
            min="0"
            step="1"
            value={form.budget}
            onChange={handleChange}
            required
            placeholder="e.g. 1000"
            className="block w-full border p-2"
          />
        </div>

        <div>
          <label htmlFor="soilType">Soil type *</label>
          <select
            id="soilType"
            name="soilType"
            value={form.soilType}
            onChange={handleChange}
            required
            className="block w-full border p-2"
          >
            <option value="">Select soil type</option>
            {SOIL_TYPES.map((soil) => (
              <option key={soil} value={soil}>
                {soil}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p role="alert" className="text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="border px-4 py-2 disabled:opacity-50"
        >
          {loading ? "Uploading and diagnosing..." : "Diagnose crop"}
        </button>

        <button
          type="button"
          onClick={handleReset}
          disabled={loading}
          className="ml-2 border px-4 py-2 disabled:opacity-50"
        >
          Reset form
        </button>
      </form>
    </main>
  );
}
