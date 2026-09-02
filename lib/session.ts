import crypto from "crypto";

const COOKIE_NAME = "lillelam_dashboard";

function secret() {
  return process.env.SESSION_SECRET || "dev-only-secret";
}

export function viewerPasswordEnabled() {
  return Boolean(process.env.DASHBOARD_PASSWORD);
}

export function makeViewerToken() {
  return crypto.createHmac("sha256", secret()).update("viewer-ok").digest("hex");
}

export function isViewerTokenValid(token?: string) {
  if (!viewerPasswordEnabled()) return true;
  if (!token) return false;
  const expected = makeViewerToken();
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

export { COOKIE_NAME };
