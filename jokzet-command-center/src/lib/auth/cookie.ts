// Kept free of server-only imports so the proxy can share the name.
const secure = process.env.NODE_ENV === "production";

/** `__Host-` prefix (production) forces Secure, Path=/ and no Domain attribute. */
export const SESSION_COOKIE = secure ? "__Host-jz_session" : "jz_session";

export const sessionCookieOptions = (expires: Date) =>
  ({
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    expires,
  }) as const;
