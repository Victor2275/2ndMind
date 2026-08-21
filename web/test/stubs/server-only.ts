// The real `server-only` package throws on import outside a React Server Component.
// Vitest resolves the client condition, so it is aliased to this no-op for tests.
// The production guard is unaffected: this alias exists only in vitest.config.mts.
export {};
