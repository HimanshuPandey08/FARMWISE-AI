
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

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Could not read image."));

    reader.onload = () => {
      const img = new Image();

      img.onerror = () => reject(new Error("Invalid image."));

      img.onload = () => {
        const maxDimension = 1200;
        const scale = Math.min(
          1,
          maxDimension / Math.max(img.width, img.height)
        );

        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);

        const context = canvas.getContext("2d");

        if (!context) {
          reject(new Error("Image processing is unavailable."));
          return;
        }

        context.drawImage(img, 0, 0, canvas.width, canvas.height);

        try {
          resolve(canvas.toDataURL("image/jpeg", 0.75));
        } catch {
          reject(new Error("Could not compress the image."));
        }
      };

      img.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}

export default function DiagnosePage() {
  const router = useRouter();

  const [form, setForm] = useState(INITIAL_FORM);
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Release the previous preview URL when it changes or the page unmounts.
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

    if (file.size > MAX_FILE_SIZE) {
      event.target.value = "";
      setError("Image must be 10 MB or smaller.");
      return;
    }

    setImage(file);
    setPreview(URL.createObjectURL(file));
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
      const imageData = await compressImage(image);

      const report = {
        id: "draft",
        cropName: form.cropName.trim(),
        cropAge,
        ageUnit: form.ageUnit,
        location: form.location.trim(),
        budget,
        soilType: form.soilType,
        imageName: image.name,
        imageData,
        createdAt: new Date().toISOString(),
      };

      sessionStorage.setItem(
        "farmwise-current-report",
        JSON.stringify(report)
      );

      router.push("/report/draft");
    } catch (err) {
      console.error(err);
      setError(
        "Could not prepare the image. Please try another photograph."
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

        {error && <p role="alert">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? "Preparing report..." : "Submit crop details"}
        </button>

        <button type="button" onClick={handleReset}>
          Reset form
        </button>
      </form>
    </main>
  );
}
