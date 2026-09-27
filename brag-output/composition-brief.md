# Hyperframes Composition Brief: LoadLite

## Objective
Create a polished, editorial-style product launch video (18 seconds, landscape 1920x1080) for LoadLite — an automated closed-loop load testing platform built natively on AWS.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 18 seconds (540 frames @ 30fps)

## Source Material
- Project root: `c:/Users/baodh/OneDrive/Desktop/Projects/LoadLite`
- Primary files: `dashboard/src/App.jsx`, `dashboard/src/index.css`, `dashboard/index.html`, `architecture-diagram.jpg`, `README.md`
- Product name: LoadLite
- Tagline: Closed-Loop AWS Load Benchmark
- Key visual moments:
  - Live Target Pulse rolling SVG oscilloscope (113ms idle baseline to 6,000ms saturation spike)
  - Escalation Curve: P95 latency curve climbing to 10,000ms timeout ceiling
  - Stat cards: Total Volume (1,894), Tail P95 (10,022ms), Failure Rate (91.76%)
  - Clean light-theme AWS Architecture reveal

## Creative Direction
- Tone preset: `polished`
- Creative direction: `editorial technical product film`
- Interpretation: Restrained, confident pacing; crisp Google Fonts typography (Fraunces serif display, JetBrains Mono numeric telemetry, Plus Jakarta Sans UI); warm paper aesthetic.
- Avoid: Flashing neon, generic dark SaaS cards, childish 3D icons, rapid unreadable cuts.

## Visual Identity
- Background: `#fbfaf8` (Warm canvas paper)
- Panels / Surfaces: `#ffffff` with hairline `#e6e2d8` border
- Accent: `#b45309` (Burnt terracotta)
- Saturated / Error Accent: `#b91c1c` (Crimson drop zone)
- Responsive / Success Accent: `#15803d` (Emerald green)
- Text primary: `#1c1917` (Deep stone charcoal)
- Text secondary: `#57534e` (Muted warm slate)
- Fonts:
  - Heading Display: `Fraunces, serif`
  - Body: `Plus Jakarta Sans, sans-serif`
  - Technical / Numeric: `JetBrains Mono, monospace`

## Storyboard & Timing (18s total)
1. **Scene 1 (0.0s – 3.5s)**: Hook & Baseline
   - "What happens when you push a server past its breaking point?"
   - Live Target Pulse oscilloscope resting at 113ms (Green: "Responsive").
2. **Scene 2 (3.5s – 8.0s)**: Concurrency Ramp
   - Ramp Controller: Target `/compute`, stages `10, 50, 100`.
   - "Run Concurrency Ramp" triggers. Step Functions state machine initiates.
   - Concurrency workers spin up across AWS Lambda fleet.
3. **Scene 3 (8.0s – 13.5s)**: The Breaking Point
   - Oscilloscope spikes vertically: 6,000ms+ (Crimson: "Saturated / Queued").
   - Stats surge: 1,894 Volume, 10,022ms Tail P95, 91.76% Failure Rate.
   - Saturation curve climbs to the 10,000ms Timeout Limit.
4. **Scene 4 (13.5s – 18.0s)**: Architecture & Outro
   - Clean architectural overview: Step Functions → Lambda Fleet → EC2 Target → DynamoDB.
   - Outro headline: "Break your servers before your users do."
   - Logo: **LoadLite** in Fraunces serif with subtitle "Closed-loop load benchmarking on AWS".

## Audio
- Audio track: `happy-beats-business-moves-vol-9-by-ende-dot-app.mp3`
- Audio role: Warm rhythmic bed with precise technical pacing.
- Volume posture: 0.75 nominal volume, smooth fade-out during final 1.5s logo hold.
