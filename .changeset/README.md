# Changesets

Cloud Driver uses `changesets` for the public CLI package release flow.

Typical flow:

1. Run `pnpm changeset`
2. Select `@shier-art/cd-cli`
3. Choose a version bump level
4. Commit the generated `.changeset/*.md`
5. Merge to `main`

After merge:

1. GitHub Actions creates or updates the release PR
2. Merging the release PR publishes `@shier-art/cd-cli`
