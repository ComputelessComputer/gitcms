import { parse, serialize } from "cookie";
import { sealData, unsealData } from "iron-session";
import { randomBytes } from "node:crypto";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";

import { getEnv } from "../env";
import { GitcmsConfigError } from "../lib/errors";

const SESSION_COOKIE = "gitcms_session";
const OAUTH_STATE_COOKIE = "gitcms_oauth_state";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const OAUTH_STATE_TTL_SECONDS = 60 * 10;

export interface AdminSession {
  /** GitHub login. */
  login: string;
  /** GitHub display name if available. */
  name: string | null;
  /** GitHub avatar URL if available. */
  avatarUrl: string | null;
  /** OAuth access token used server-side for GitHub content operations. */
  accessToken: string;
}

export interface PublicAdminUser {
  /** GitHub login. */
  login: string;
  /** GitHub display name if available. */
  name: string | null;
  /** GitHub avatar URL if available. */
  avatarUrl: string | null;
}

/** Converts an admin session to a JSON-safe public user. */
export function toPublicAdminUser(session: AdminSession): PublicAdminUser {
  return {
    login: session.login,
    name: session.name,
    avatarUrl: session.avatarUrl,
  };
}

/** Creates and stores a new OAuth state cookie. */
export async function createOauthState(): Promise<string> {
  const state = randomBytes(24).toString("hex");
  const sealed = await sealData({ state }, { password: getSessionSecret(), ttl: OAUTH_STATE_TTL_SECONDS });
  setResponseHeader("Set-Cookie", cookieHeader(OAUTH_STATE_COOKIE, sealed, OAUTH_STATE_TTL_SECONDS));
  return state;
}

/** Reads the OAuth state value from the request cookie. */
export async function readOauthState(): Promise<string | null> {
  const cookieValue = readCookie(OAUTH_STATE_COOKIE);
  if (!cookieValue) return null;
  try {
    const data = await unsealData<{ state: string }>(cookieValue, {
      password: getSessionSecret(),
      ttl: OAUTH_STATE_TTL_SECONDS,
    });
    return data.state;
  } catch {
    return null;
  }
}

/** Writes an encrypted admin session cookie. */
export async function writeAdminSession(session: AdminSession): Promise<void> {
  const sealed = await sealData(session, {
    password: getSessionSecret(),
    ttl: SESSION_TTL_SECONDS,
  });
  setResponseHeader("Set-Cookie", cookieHeader(SESSION_COOKIE, sealed, SESSION_TTL_SECONDS));
}

/** Reads and decrypts the current admin session cookie. */
export async function readAdminSession(): Promise<AdminSession | null> {
  return readAdminSessionFromCookieHeader(getRequestHeader("cookie") ?? "");
}

/** Reads and decrypts an admin session from an arbitrary Cookie header. */
export async function readAdminSessionFromCookieHeader(cookieHeaderValue: string): Promise<AdminSession | null> {
  const cookieValue = parse(cookieHeaderValue)[SESSION_COOKIE];
  if (!cookieValue) return null;
  try {
    const data = await unsealData<AdminSession>(cookieValue, {
      password: getSessionSecret(),
      ttl: SESSION_TTL_SECONDS,
    });
    if (!data.login || !data.accessToken) return null;
    return data;
  } catch {
    return null;
  }
}

/** Clears the encrypted admin session cookie. */
export function clearAdminSession(): void {
  setResponseHeader(
    "Set-Cookie",
    serialize(SESSION_COOKIE, "", {
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    }),
  );
}

function getSessionSecret(): string {
  const secret = getEnv().SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new GitcmsConfigError("SESSION_SECRET must be at least 32 characters.");
  }
  return secret;
}

function readCookie(name: string): string | null {
  const header = getRequestHeader("cookie");
  if (!header) return null;
  return parse(header)[name] ?? null;
}

function cookieHeader(name: string, value: string, maxAge: number): string {
  return serialize(name, value, {
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
