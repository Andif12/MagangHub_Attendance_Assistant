import { describe, it, expect, beforeEach } from "vitest";
import {
  monevProviderRegistry,
  ServerDirectAttendanceProvider,
  DatabaseSyncedAttendanceProvider,
} from "../src/lib/monev/provider-registry";
import { IMonevAttendanceProvider } from "../src/lib/monev/provider-interface";

describe("Monev Provider Registry (Decoupled Architecture)", () => {
  it("registers and discovers multiple attendance providers", () => {
    const providers = monevProviderRegistry.getAllAttendanceProviders();
    expect(providers.length).toBeGreaterThanOrEqual(2);

    const direct = monevProviderRegistry.getAttendanceProvider("server-direct");
    expect(direct).toBeDefined();
    expect(direct?.mechanismType).toBe("DIRECT_SERVER_CREDENTIALS");

    const synced = monevProviderRegistry.getAttendanceProvider("db-synced");
    expect(synced).toBeDefined();
    expect(synced?.mechanismType).toBe("BROWSER_COMPANION_BRIDGE");
  });

  it("dynamically selects active provider based on configuration", () => {
    // When no env credentials, it falls back to verified db-synced store
    const active = monevProviderRegistry.getActiveAttendanceProvider();
    expect(active).toBeDefined();
    expect(active.id).toBe("db-synced");
  });

  it("allows registering custom external attendance providers without altering dashboard", () => {
    const mockCustomProvider: IMonevAttendanceProvider = {
      id: "custom-gateway",
      name: "Custom Enterprise Gateway",
      description: "Gateway proxy integrasi kementerian khusus",
      mechanismType: "DIRECT_SERVER_CREDENTIALS",
      isConfigured: () => true,
      fetchAttendances: async () => ({
        success: true,
        statusCode: 200,
        records: [
          {
            date: "2026-10-10",
            status: "PRESENT",
            approval_status: "APPROVED",
          },
        ],
        message: "Sukses dari gateway",
      }),
    };

    monevProviderRegistry.registerAttendanceProvider(mockCustomProvider);
    const retrieved = monevProviderRegistry.getAttendanceProvider("custom-gateway");
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe("Custom Enterprise Gateway");
  });
});
