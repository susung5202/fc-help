"use client";

import { useEffect } from "react";

const CANONICAL_HOST = "fchelp.xyz";
const LEGACY_HOSTS = new Set(["fc-help-chi.vercel.app"]);

export default function CanonicalHostGuard() {
  useEffect(() => {
    const { hostname, pathname, search, hash } = window.location;

    if (!LEGACY_HOSTS.has(hostname)) return;

    window.location.replace(`https://${CANONICAL_HOST}${pathname}${search}${hash}`);
  }, []);

  return null;
}
