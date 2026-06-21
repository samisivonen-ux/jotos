# Route Animation And Social Video

Jotos should let people turn a saved route into a short shareable map story.

## MVP

The browser prototype supports:

- route playback on the map
- animated current-position marker
- highlighted travelled route line
- browser-side H.264/MP4 encoding with WebCodecs and Mediabunny
- selectable playback timing: even distance-based pace or relative GPX point timestamps
- a global speed multiplier while preserving GPX segment-time ratios
- a draggable elevation overlay that can be included at the same map-relative position in the video
- independent start and finish trimming in metres before playback or export
- a continuous elevation-overlay background opacity control
- browser-side compositing of the MapLibre canvas and selected video overlays
- local MP4 download without uploading private route data

The client checks H.264 support before encoding. A future server renderer remains useful for devices without WebCodecs and for queued long-form exports.

## Production Renderer

Use a server-side render worker for polished exports:

- render map frames with MapLibre and a fixed viewport
- compose title, distance, elevation, logo and attribution overlays
- encode with FFmpeg
- output MP4/H.264 for maximum compatibility
- optionally output WebM/VP9 for open web publishing

AWS shape:

- S3 stores input GPX/GeoJSON and output videos
- EventBridge starts render jobs
- Lambda works for short clips
- AWS Batch or ECS Fargate works for heavier FFmpeg jobs
- DynamoDB tracks render job state

## Export Presets

| Preset | Resolution | FPS | Video bitrate | App duration cap |
| --- | ---: | ---: | ---: | ---: |
| Instagram Reels | `1080x1920` | 30 | 8 Mbps | 3 min recommendation window |
| WhatsApp | `720x1280` | 30 | 4 Mbps | 90 s compact-share preset |
| Facebook Reels | `1080x1920` | 30 | 8 Mbps | 3 min preset |
| YouTube Shorts | `1080x1920` | 30 | 8 Mbps | 3 min |
| YouTube | `1920x1080` | 30 | 8 Mbps | 15 min preset |
| Master / Final Cut | `3840x2160` | 30 | 45 Mbps | 60 min preset |

The UI estimates the output size from bitrate and the current playback duration. Platform rules change, so these are export profiles rather than promises that a third-party service will always accept a file.

## Privacy

Before rendering public videos:

- trim private home/work zones
- remove exact timestamps unless the user opts in
- avoid exposing hidden waypoints or private route notes
- show route license and OSM attribution when open map data is visible

## Future Features

- animated progress within the elevation profile
- split markers and pace overlays
- route fly-through camera
- music-safe silent exports
- branded templates for clubs and events
- one-click share links for WhatsApp, Telegram and social platforms
