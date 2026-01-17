# Test Fixtures

Minimal, self-contained test packages for testing specific functionality without network access.

## Structure

```
fixtures/
  basic/         # ESM, CJS, mixed modules
  styles/        # CSS/SCSS packages
  dependencies/  # Nested, peer, and deep dependencies
  errors/        # Error scenarios (missing deps, invalid syntax)
  exports/       # Export patterns and re-exports
  sizes/         # Small, medium, large packages
```

## Guidelines

- Keep fixtures minimal
- One fixture per scenario
- Include README.md explaining what's tested
- Use descriptive names
