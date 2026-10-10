import { NextResponse } from "next/server";

interface EndpointProbe {
  name: string;
  url: string;
  method: string;
  status: number | null;
  statusText: string | null;
  latencyMs: number;
  corsOrigin: string | null;
  wafCookie: boolean;
  contentType: string | null;
  responseSnippet: string | null;
  error?: string;
}

export async function GET() {
  const probes: EndpointProbe[] = [];

  const targets = [
    {
      name: "Kemnaker SIAPkerja ID SSO Portal",
      url: "https://account.kemnaker.go.id/auth/login",
      method: "GET",
    },
    {
      name: "Monev OAuth Auth Initiator",
      url: "https://monev-api.maganghub.kemnaker.go.id/api/v1/auth/login",
      method: "GET",
    },
    {
      name: "Monev OAuth Callback Exchange",
      url: "https://monev-api.maganghub.kemnaker.go.id/api/v1/auth/login/callback?code=probe_test&state=probe_state",
      method: "GET",
    },
    {
      name: "Monev User Profile Endpoint",
      url: "https://monev-api.maganghub.kemnaker.go.id/api/v1/users/me",
      method: "GET",
    },
    {
      name: "Monev Attendances Endpoint",
      url: "https://monev-api.maganghub.kemnaker.go.id/api/v1/attendances",
      method: "GET",
    },
  ];

  for (const target of targets) {
    const start = Date.now();
    try {
      const res = await fetch(target.url, {
        method: target.method,
        redirect: "manual",
        headers: {
          "User-Agent": "MagangHub-Attendance-Assistant/0.1.0",
          Accept: "application/json, text/html, */*",
        },
      });

      const latency = Date.now() - start;
      const text = await res.text();
      const setCookie = res.headers.get("set-cookie") || "";
      const hasWaf = setCookie.includes("acw_tc") || res.headers.has("cf-ray");

      probes.push({
        name: target.name,
        url: target.url,
        method: target.method,
        status: res.status,
        statusText: res.statusText,
        latencyMs: latency,
        corsOrigin: res.headers.get("access-control-allow-origin"),
        wafCookie: hasWaf,
        contentType: res.headers.get("content-type"),
        responseSnippet: text.slice(0, 300),
      });
    } catch (err: unknown) {
      const latency = Date.now() - start;
      probes.push({
        name: target.name,
        url: target.url,
        method: target.method,
        status: null,
        statusText: null,
        latencyMs: latency,
        corsOrigin: null,
        wafCookie: false,
        contentType: null,
        responseSnippet: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    probes,
    technicalSummary: {
      ssoPortalOnline: probes[0]?.status === 200,
      authApiOnline: probes[1]?.status === 201,
      corsRestricted: probes.every((p) => p.corsOrigin === null),
      wafProtected: probes.some((p) => p.wafCookie),
    },
  });
}
