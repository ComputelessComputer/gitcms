/** Stable error names used across serialized server-function boundaries. */
export const GITCMS_ERROR_NAMES = {
  unauthorized: "AdminUnauthorizedError",
  githubReauth: "GitHubReauthError",
  config: "GitcmsConfigError",
  validation: "GitcmsValidationError",
  storage: "GitcmsStorageError",
  github: "GitcmsGitHubError",
} as const;

/** Base class for all typed gitcms application errors. */
export class GitcmsError extends Error {
  /** Creates a typed gitcms error with a stable serialized name. */
  constructor(message: string, name = "GitcmsError") {
    super(message);
    this.name = name;
  }
}

/** Error thrown when an admin session is missing or invalid. */
export class AdminUnauthorizedError extends GitcmsError {
  /** Creates an admin authorization error. */
  constructor(message = "Sign in with an authorized GitHub account.") {
    super(message, GITCMS_ERROR_NAMES.unauthorized);
  }
}

/** Error thrown when GitHub credentials need to be refreshed. */
export class GitHubReauthError extends GitcmsError {
  /** Creates a GitHub reauthorization error. */
  constructor(message = "GitHub authorization expired. Sign in again.") {
    super(message, GITCMS_ERROR_NAMES.githubReauth);
  }
}

/** Error thrown when runtime configuration is invalid or unavailable. */
export class GitcmsConfigError extends GitcmsError {
  /** Creates a config error. */
  constructor(message: string) {
    super(message, GITCMS_ERROR_NAMES.config);
  }
}

/** Error thrown when user input passes transport validation but fails a domain rule. */
export class GitcmsValidationError extends GitcmsError {
  /** Creates a validation error. */
  constructor(message: string) {
    super(message, GITCMS_ERROR_NAMES.validation);
  }
}

/** Error thrown by storage adapters. */
export class GitcmsStorageError extends GitcmsError {
  /** Creates a storage error. */
  constructor(message: string) {
    super(message, GITCMS_ERROR_NAMES.storage);
  }
}

/** Error thrown by GitHub content operations. */
export class GitcmsGitHubError extends GitcmsError {
  /** Creates a GitHub content error. */
  constructor(message: string) {
    super(message, GITCMS_ERROR_NAMES.github);
  }
}

/** Returns true when a serialized error should redirect to sign-in. */
export function isAdminAuthError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === GITCMS_ERROR_NAMES.unauthorized || error.name === GITCMS_ERROR_NAMES.githubReauth
  );
}
