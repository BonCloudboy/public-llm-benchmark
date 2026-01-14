# Public Site

Static public leaderboard site for the LLM benchmark. This repo contains the
static HTML/CSS/JS along with exported benchmark data in `benchmarks/`.

## Update the data

1) Run the export in the private benchmark repo.
2) The export writes into `public-site/benchmarks/`.
3) Commit and push from this repo.

## Deploy

Deployment is handled by GitHub Actions in `.github/workflows/publish.yml`.
Push to `main` (or run the workflow manually) to publish the site.
