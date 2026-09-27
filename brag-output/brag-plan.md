# Brag Plan: LoadLite

## What is this app?
LoadLite is a closed-loop distributed load testing platform on AWS that orchestrates Step Functions concurrency ladders, fires parallel Lambda fleets against an EC2 target, and plots live saturation curves with microsecond telemetry.

## The angle
Most load-testing tools test black boxes. LoadLite puts you in the cockpit of both the load generator and the target server — watching an EC2 instance hit 100% CPU saturation and cliff-dive into the 10,000ms drop zone live on video, rendered with editorial typographic luxury.

## Hook (first 2-3 seconds)
A stark, high-contrast title card in editorial serif:
**"What happens when you push AWS to its breaking point?"**
Followed immediately by a clean baseline pulse of 113ms before the ramp kicks in.

## Key moments (the middle)
- **Moment 1: The Escalation Trigger** — Ramp Controller firing concurrency stages `[10, 50, 100]` with AWS Step Functions.
- **Moment 2: The Squeal & The Spike** — Live Target Pulse oscilloscope turning amber then red as latency climbs from 113ms past 6,000ms.
- **Moment 3: The Saturation Curve** — Real-time SVG chart showing tail P95 hitting the 10,000ms timeout ceiling and failure rate spiking to 91.76%.
- **Moment 4: The Closed Loop Architecture** — Clean architectural reveal showing the AWS Lambda fleet, EC2 instance, and DynamoDB results ledger.

## Outro / punchline
"100% Infrastructure-as-Code. Zero SaaS dependencies.
**LoadLite — Break your servers before production does.**"

## User flow worth showing
1. **Entry**: Baseline idle state on warm paper canvas with the green `Responsive` heartbeat pulse (113ms).
2. **Key Action**: Selecting `/compute` and hitting **"Run Concurrency Ramp"**.
3. **Result**: Live oscilloscope waveform spikes up to the 10,000ms drop ceiling, stats cards surge (1,894 volume, 91.76% failure), and the saturation curve locks in.

## Tone
- Preset: `polished`
- Creative direction: `editorial technical product film`
- Interpretation: Restrained pacing, confident typographic hierarchy, warm paper aesthetic, no frantic motion — letting the sheer scale of server saturation do the talking.

## Format: landscape — 1920x1080
## Duration: 18s

## Visual identity (from the project)
- Background: `#fbfaf8` (Warm paper)
- Card Surface: `#ffffff` with hairline `#e6e2d8` border
- Accent: `#b45309` (Burnt amber / terracotta)
- Drop Zone Accent: `#b91c1c` (Crimson limit)
- Success / Idle Accent: `#15803d` (Emerald responsive)
- Display font: `Fraunces, serif`
- Secondary Display: `Instrument Serif, serif`
- Body & UI font: `Plus Jakarta Sans, sans-serif`
- Technical & Numeric font: `JetBrains Mono, monospace`
- Strongest visual element: Live Target Pulse SVG oscilloscope with pulsing glowing dot & Saturation Curve ceiling.

## Share copy (draft)
"I built a closed-loop load testing engine on AWS from scratch — and watched an EC2 server choke live on video. 💥👇
Step Functions + Lambda fleet + DynamoDB microsecond telemetry. Zero SaaS dependencies.
#AWS #CloudEngineering #DevOps #SystemDesign"

## Audio direction
- Role: Warm rhythmic bed with crisp technical accents
- Music: `happy-beats-business-moves-vol-9-by-ende-dot-app.mp3`
- Music treatment: Subtle fade-in, builds under the concurrency ramp, swells at the saturation spike, settles under the outro logo.
- SFX posture: Sparse, motion-matched subtle clicks and frequency swell at peak saturation.

## Storyboard

### Scene 1 — The Provocation — 3.0s
- Big, confident display serif headline: *"What happens when you push a server past its breaking point?"*
- Subtitle: *"LoadLite: Closed-Loop AWS Load Testing"*
- Idle Live Target Pulse oscillating smoothly at ~113ms in green.
- Audio intent: Warm rhythmic beat begins, crisp baseline tick.
- Transition mood: Clean cut to ramp trigger.

### Scene 2 — The Escalation — 4.5s
- The Ramp Controller: `/compute` selected, concurrency stages `10, 50, 100` illuminated.
- CTA button fires: *"Run Concurrency Ramp"*
- Distributed Lambda workers deploy in parallel.
- Step Functions state machine indicator transitions to RUNNING.
- Audio intent: Beat builds with momentum, subtle click SFX on trigger.

### Scene 3 — The Breaking Point — 5.5s
- The Live Target Pulse oscilloscope turns amber then crimson.
- Waveform spikes vertically towards 6,000ms+.
- Metric cards climb: Volume: 1,894 | P95: 10,022ms | Failure: 91.76%.
- Latency & Saturation curve rises steeply to the red dashed drop zone line: *"10,000ms Timeout Limit (Connections Dropped)"*.
- Audio intent: High energy, dramatic frequency swell on saturation spike.

### Scene 4 — The Architecture & Outro — 5.0s
- Elegant presentation of the AWS Architecture: Step Functions → Lambda Fleet → EC2 Target → DynamoDB Ledger.
- Final headline: *"Break your servers before your users do."*
- Logo: **LoadLite** in Fraunces serif with subtitle: *"Closed-loop load benchmarking on AWS"*.
- Audio intent: Music fades down smoothly to a confident final beat.

**Music mood for this video:** Confident, driving modern electronic groove.
**Audio summary:** Starts clean and focused, accelerates during the concurrency ramp, peaks at the saturation cliff, and lands on a polished editorial outro.
