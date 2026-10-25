---
'package-build-stats': minor
---

Allow hosts to supply an async `cleanup` callback for SDK-owned workspaces and explicit disposal. Use portable deletion by default instead of Linux-specific scheduling commands; lease release and cleanup-error handling are preserved.

Expose the package manager that actually succeeded on installation results, and add opt-in `saveLockfile` for Bun text lockfiles so hosts can account for resolved dependencies without traversing package contents.

Allow a host `packageManagerCommand` wrapper (for example, a shared OS lock) while retaining SDK command timeouts, cancellation and package-manager error handling.
