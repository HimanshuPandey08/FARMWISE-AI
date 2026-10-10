
"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export default function ProtectedPage({ children }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const { data: session } = await authClient.getSession();

        if (!active) return;

        if (!session) {
          router.replace("/login");
          return;
        }

        setAuthorized(true);
      } catch {
        if (active) {
          router.replace("/login");
        }
      }
    }

    checkSession();

    return () => {
      active = false;
    };
  }, [router]);

  if (!authorized) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        Checking your session...
      </main>
    );
  }

  return children;
}
