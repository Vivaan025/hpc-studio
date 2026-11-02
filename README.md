# HPC Studio

Hi, I'm Vivaan. I got into GPU programming the way most people do: I wrote a CUDA kernel, it was slow, and nobody could tell me *why* in a way I could picture. So I started drawing what the hardware was doing, step by step, value by value. Those drawings turned into this site.

**HPC Studio** is a small, interactive blog about what actually happens inside a GPU. Every post comes with animations you can play, pause and step through, built from real runs on real hardware (usually the RTX 3050 in my laptop). No hand-waving, no "trust me it's faster". If a post says 6.4×, there's a test case and a terminal dump next to it.

## What's inside

**Kernels** you can step through, thread by thread:
- Vector addition, the hello world of CUDA
- Parallel reduction, naive to warp shuffles
- Matrix multiplication, naive, coalesced and tiled

**Blog posts** that go one level deeper:
- CUDA Graphs: stop paying the launch tax
- Understanding GPU architecture from scratch
- Memory coalescing, the #1 performance trick
- Shared memory bank conflicts explained

And a little GPU toy on the home page. Click it. Hold the mouse down. Try the `o` key.

## Who this is for

Me from two years ago. If you can read a `for` loop and have heard the word "thread", you're ready. If you already write CUDA for a living, the visualizations are still a nice way to explain things to your teammates.

## Run it locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000. It's a plain Next.js app with Tailwind, nothing exotic.

## Contributing

Spotted a mistake, or a kernel you wish was visualized? Open an issue. If you want to add a simulation, look at `src/components/simulations/` for the pattern: a step list, a code panel with highlighted lines, and a shared control bar.

## License

MIT. Use the animations in your talks and classes, just link back.
