import { describe, expect, it } from "vitest";
import {
  buildR2PublicUrl,
  getWindowsInstallerDownloadConfig,
  verifyWindowsInstallerDownload,
  WINDOWS_INSTALLER_EXPECTED_BYTES,
  WINDOWS_INSTALLER_R2_OBJECT_KEY,
  WINDOWS_INSTALLER_SAVE_AS,
} from "./windows-installer-download";

const RUN_NETWORK_TESTS = process.env.RUN_NETWORK_TESTS === "1";

describe("windows-installer-download", () => {
  it("builds the encoded Cloudflare R2 URL for the current object key", () => {
    expect(buildR2PublicUrl(WINDOWS_INSTALLER_R2_OBJECT_KEY)).toBe(
      "https://pub-f00266e4b83341dea437c0114752f536.r2.dev/SabbathCue_0.1.7_x64-setup.exe"
    );
  });

  it("exposes stable download config for the marketing site", () => {
    const config = getWindowsInstallerDownloadConfig();
    expect(config.version).toBe("0.1.7");
    expect(config.saveAsFilename).toBe("SabbathCue-Setup.exe");
    expect(config.objectKey).toBe("SabbathCue_0.1.7_x64-setup.exe");
    expect(config.url).toContain("pub-f00266e4b83341dea437c0114752f536.r2.dev");
    expect(config.url).toContain("0.1.7");
  });

  it("uses a clean save-as filename (not the R2 duplicate suffix)", () => {
    expect(WINDOWS_INSTALLER_SAVE_AS).toBe("SabbathCue-Setup.exe");
    expect(WINDOWS_INSTALLER_SAVE_AS).not.toContain("(");
  });

  it.runIf(RUN_NETWORK_TESTS)(
    "HEAD-checks the live R2 installer (network)",
    async () => {
      const result = await verifyWindowsInstallerDownload();
      expect(result.ok, result.ok ? undefined : result.reason).toBe(true);
      if (result.ok) {
        expect(result.bytes).toBeGreaterThanOrEqual(200 * 1024 * 1024);
        expect(result.bytes).toBe(WINDOWS_INSTALLER_EXPECTED_BYTES);
        expect(result.contentType).toContain("application/x-msdownload");
      }
    },
    30000
  );
});
