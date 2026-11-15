import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
export type Session = {
  id: string;
  role: "owner" | "clinic" | "admin";
  clinicId?: string;
  expires: number;
};
function secret() {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)
    throw new Error("SESSION_SECRET must be at least 32 characters.");
  return process.env.SESSION_SECRET;
}
export async function session(): Promise<Session | null> {
  const raw = (await cookies()).get("vetpath_session")?.value;
  if (!raw) return null;
  const [body, sig] = raw.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret()).update(body).digest("hex");
  if (
    expected.length !== sig.length ||
    !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  )
    return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString());
    return data.expires > Date.now() ? data : null;
  } catch {
    return null;
  }
}
export async function setSession(role: Session["role"], clinicId?: string) {
  const old = await session();
  const s: Session = {
    id: old?.id || randomUUID(),
    role,
    clinicId,
    expires: Date.now() + 86400000,
  };
  const body = Buffer.from(JSON.stringify(s)).toString("base64url");
  (await cookies()).set(
    "vetpath_session",
    body + "." + createHmac("sha256", secret()).update(body).digest("hex"),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.COOKIE_SECURE === "true",
      path: "/",
      maxAge: 86400,
    },
  );
  return s;
}
