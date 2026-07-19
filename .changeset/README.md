# Changesets

Every pull request that changes the published package should include a changeset:

```sh
yarn changeset
```

Choose `patch`, `minor`, or `major` using semantic-versioning rules and write a
short user-facing summary. Documentation and CI-only changes do not need one.

After changes land on `master`, the release workflow maintains a "Version
Packages" pull request. Merging that pull request publishes the new version to
npm, creates the git tag, and creates a GitHub release.

Publishing uses npm trusted publishing (OIDC), not a long-lived npm token. The
trusted publisher for `package-build-stats` must point at:

- GitHub owner: `pastelsky`
- Repository: `package-build-stats`
- Workflow: `release.yml`
- Permission: `npm publish`
