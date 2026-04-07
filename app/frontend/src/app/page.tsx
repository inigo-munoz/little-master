"use client";

import { Sidebar } from "../components/layout/Sidebar";

// Root page redirects to campaigns dashboard
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/campaigns"); }, [router]);
  return null;
}
