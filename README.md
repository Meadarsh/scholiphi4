# ScholiPhi 4

Home, AI Time Savings, ScholiPhi OS, and Pricing.

Standalone static app derived from ScholiPhi commit `43b98c0`. Includes the mobile voice-tour playback fixes. Live demo and booking forms remain available from the landing page.

Run locally:

```sh
python -m http.server 8000
```

Open http://localhost:8000. No build step is required.

Run checks:

```sh
node tests/voice-tour.test.cjs
node tests/version.test.cjs
```
