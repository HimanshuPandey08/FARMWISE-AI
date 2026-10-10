
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ProtectedPage from "@/components/ProtectedPage";

const initialProfile = {
  phone: "",
  village: "",
  district: "",
  state: "",
  farmSize: "",
  soilType: "",
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const response = await fetch("/api/profile");
        const data = await response.json();

        if (!response.ok) {
          if (response.status === 401) {
            router.replace("/login");
            return;
          }

          throw new Error(data.error || "Could not load profile.");
        }

        if (active && data.profile) {
          setProfile({
            ...initialProfile,
            ...data.profile,
          });
        }
      } catch (error) {
        if (active) {
          setMessage(error.message || "Could not load profile.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [router]);

  function handleChange(event) {
    const { name, value } = event.target;

    setProfile((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(profile),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        throw new Error(data.error || "Could not save profile.");
      }

      setMessage("Farmer profile saved successfully.");
    } catch (error) {
      setMessage(error.message || "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProtectedPage>
      <main className="mx-auto min-h-screen max-w-2xl p-6">
        <h1 className="mb-2 text-3xl font-bold">Farmer Profile</h1>
        <p className="mb-6 text-gray-600">
          Save your farm details to personalize future recommendations.
        </p>

        {loading ? (
          <p>Loading your profile...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {[
              { name: "phone", label: "Phone number", type: "tel" },
              { name: "village", label: "Village" },
              { name: "district", label: "District" },
              { name: "state", label: "State" },
              { name: "farmSize", label: "Farm size (e.g. 2 acres)" },
            ].map((field) => (
              <div key={field.name}>
                <label
                  htmlFor={field.name}
                  className="mb-1 block font-medium"
                >
                  {field.label}
                </label>

                <input
                  id={field.name}
                  name={field.name}
                  type={field.type || "text"}
                  value={profile[field.name]}
                  onChange={handleChange}
                  maxLength={150}
                  className="w-full rounded-lg border p-3"
                />
              </div>
            ))}

            <div>
              <label
                htmlFor="soilType"
                className="mb-1 block font-medium"
              >
                Soil type
              </label>

              <select
                id="soilType"
                name="soilType"
                value={profile.soilType}
                onChange={handleChange}
                className="w-full rounded-lg border p-3"
              >
                <option value="">Select soil type</option>
                <option value="Alluvial">Alluvial</option>
                <option value="Black">Black</option>
                <option value="Red">Red</option>
                <option value="Laterite">Laterite</option>
                <option value="Sandy">Sandy</option>
                <option value="Clay">Clay</option>
                <option value="Loamy">Loamy</option>
                <option value="Other">Other / Unknown</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-green-700 px-6 py-3 font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Profile"}
            </button>

            {message && (
              <p role="status" className="text-sm">
                {message}
              </p>
            )}
          </form>
        )}

        <p className="mt-6">
          <Link href="/" className="underline">
            Back to home
          </Link>
        </p>
      </main>
    </ProtectedPage>
  );
}
