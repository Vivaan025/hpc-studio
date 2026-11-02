"use client";

import CodeBlock from "@/components/blog/CodeBlock";
import GraphCaptureSimulation from "@/components/simulations/GraphCaptureSimulation";
import LaunchTimelineSimulation from "@/components/simulations/LaunchTimelineSimulation";

/* ── small prose helpers so the post reads like the rest of the site ── */
const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[#5e4a30] leading-relaxed mb-4">{children}</p>
);
const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="font-heading text-xl font-bold text-[#2a1c0d] mt-12 mb-4">{children}</h2>
);
const H3 = ({ children }: { children: React.ReactNode }) => (
  <h3 className="font-heading text-base font-semibold text-[#2a1c0d] mt-8 mb-3">{children}</h3>
);
const B = ({ children }: { children: React.ReactNode }) => (
  <strong className="text-[#2a1c0d] font-semibold">{children}</strong>
);
const C = ({ children }: { children: React.ReactNode }) => (
  <code className="px-1.5 py-0.5 bg-[#ebe0ca] text-[#2a1c0d] text-xs font-mono">{children}</code>
);
const Quote = ({ children }: { children: React.ReactNode }) => (
  <blockquote className="border-l-2 border-[#2a1c0d] pl-4 italic text-[#5e4a30] my-6">{children}</blockquote>
);
const Figure = ({ title, caption, children }: { title: string; caption?: string; children: React.ReactNode }) => (
  <figure className="my-8 border border-[#dccfb2] p-4 sm:p-5 lg:-mx-32">
    <div className="text-[10px] font-mono text-[#967f5e] uppercase tracking-widest mb-4">{title}</div>
    {children}
    {caption && <figcaption className="text-xs text-[#967f5e] mt-4 leading-relaxed">{caption}</figcaption>}
  </figure>
);

/* ── measured results (RTX 3050 Laptop, CUDA 12.6, Windows 11, driver 560.76) ── */
const RESULTS = [
  { label: "Small kernels (N = 16,384)", stream: 334.5, graph: 52.1, cpuStream: 334.5, cpuGraph: 29.5 },
  { label: "Big kernels (N = 4,194,304)", stream: 6286.8, graph: 6215.2, cpuStream: 6075.6, cpuGraph: 3041.8 },
];

function ResultBars() {
  return (
    <div className="space-y-6">
      {RESULTS.map((r) => {
        const max = r.stream;
        const row = (name: string, v: number, dark: boolean) => (
          <div className="flex items-center gap-3">
            <div className="w-28 sm:w-36 text-[11px] font-mono text-[#5e4a30] shrink-0">{name}</div>
            <div className="flex-1 h-6 bg-[#f3eadb] border border-[#dccfb2] relative">
              <div className={`h-full ${dark ? "bg-[#2a1c0d]" : "bg-[#967f5e]"}`} style={{ width: `${Math.max(1.5, (v / max) * 100)}%` }} />
            </div>
            <div className="w-24 text-right text-[11px] font-mono text-[#2a1c0d]">{v.toFixed(1)} ms</div>
          </div>
        );
        return (
          <div key={r.label}>
            <div className="text-xs font-semibold text-[#2a1c0d] mb-2">
              {r.label} <span className="font-normal text-[#967f5e] font-mono">· 30 kernels × 1000 iterations · {(r.stream / r.graph).toFixed(2)}× speedup</span>
            </div>
            <div className="space-y-1.5">
              {row("stream launches", r.stream, false)}
              {row("graph replay", r.graph, true)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── static DAG: a fork/join graph captured from two streams ── */
function ForkJoinDag() {
  const node = (x: number, y: number, label: string) => (
    <g key={label}>
      <rect x={x - 38} y={y - 14} width={76} height={28} fill="#2a1c0d" />
      <text x={x} y={y + 4} textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono, monospace" fill="#f7f0e1">{label}</text>
    </g>
  );
  const edge = (x1: number, y1: number, x2: number, y2: number) => (
    <line key={`${x1}${y1}${x2}${y2}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#2a1c0d" strokeWidth="1.5" markerEnd="url(#arrow)" />
  );
  return (
    <svg viewBox="0 0 560 150" className="w-full max-w-[560px] mx-auto block" role="img" aria-label="Fork and join graph: load fans out to normalize and compute_mask, which join into apply">
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#2a1c0d" />
        </marker>
      </defs>
      {node(70, 75, "load")}
      {node(250, 30, "normalize")}
      {node(250, 120, "compute_mask")}
      {node(430, 75, "apply")}
      {edge(108, 68, 210, 36)}
      {edge(108, 82, 210, 114)}
      {edge(288, 36, 390, 68)}
      {edge(288, 114, 390, 82)}
      <text x={250} y={75} textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono, monospace" fill="#967f5e">these two can overlap</text>
    </svg>
  );
}

const PIPELINE_CODE = `
__global__ void scale(float* x, float a, int n)    { int i = blockIdx.x*blockDim.x + threadIdx.x; if (i < n) x[i] *= a; }
__global__ void add_bias(float* x, float b, int n) { int i = blockIdx.x*blockDim.x + threadIdx.x; if (i < n) x[i] += b; }
__global__ void relu(float* x, int n)              { int i = blockIdx.x*blockDim.x + threadIdx.x; if (i < n) x[i] = x[i] > 0 ? x[i] : 0; }

// One "step" of the toy pipeline: 10 layers × (scale → add_bias → relu) = 30 kernels
void run_step(cudaStream_t s, float* d, int n, int layers) {
  int blocks = (n + 255) / 256;
  for (int l = 0; l < layers; ++l) {
    scale   <<<blocks, 256, 0, s>>>(d, 0.999f, n);
    add_bias<<<blocks, 256, 0, s>>>(d, 0.01f, n);
    relu    <<<blocks, 256, 0, s>>>(d, n);
  }
}
`;

const STREAM_CODE = `
// A) the way everyone writes it first
cudaEventRecord(e0, s);
for (int it = 0; it < 1000; ++it)
  run_step(s, d, N, LAYERS);          // 30 launches per call → 30,000 launches total
cudaEventRecord(e1, s);
cudaStreamSynchronize(s);
cudaEventElapsedTime(&ms_stream, e0, e1);
`;

const GRAPH_CODE = `
// B) record once, replay 1000 times
cudaGraph_t graph;
cudaGraphExec_t exec;

cudaStreamBeginCapture(s, cudaStreamCaptureModeGlobal);
run_step(s, d, N, LAYERS);            // SAME function. Nothing runs — it's recorded.
cudaStreamEndCapture(s, &graph);

cudaGraphInstantiate(&exec, graph, 0); // one-time cost, do it outside the loop

cudaEventRecord(e0, s);
for (int it = 0; it < 1000; ++it)
  cudaGraphLaunch(exec, s);           // 1 call = 30 kernels
cudaEventRecord(e1, s);
cudaStreamSynchronize(s);
cudaEventElapsedTime(&ms_graph, e0, e1);
`;

const TEST_CODE = `
// Test case: the graph must produce bit-identical output to plain launches,
// and both must match a CPU reference within float tolerance.
float* h_cpu = copy_of(h_init);
for (int it = 0; it < ITERS; ++it) run_step_cpu(h_cpu, N, LAYERS);

int bad = 0;
for (int i = 0; i < N; ++i) {
  float d_gpu = fabsf(h_stream[i] - h_graph[i]);                              // must be exactly 0
  float d_cpu = fabsf(h_stream[i] - h_cpu[i]) / (fabsf(h_cpu[i]) + 1e-6f);   // relative error
  if (d_gpu != 0.0f || d_cpu > 1e-4f) ++bad;
}
printf("TEST %s  (mismatches=%d)\\n", bad == 0 ? "PASSED" : "FAILED", bad);
`;

const OUTPUT_SMALL = `
$ nvcc -O2 -arch=sm_86 -o graph_bench graph_bench.cu
$ ./graph_bench
N=16384  layers=10  kernels/step=30  iters=1000  graph nodes=30
stream launches :   334.52 ms  (11.15 us per kernel)
graph replay    :    52.07 ms  (1.74 us per kernel)
CPU time spent enqueueing: stream=334.54 ms  graph=29.54 ms
speedup         : 6.42x
sample x[0..3] stream=9.9999 9.9999 9.9999 9.9999 graph=9.9999 9.9999 9.9999 9.9999 cpu=9.9999
TEST PASSED  (mismatches=0, max |stream-graph|=0)
`;

const OUTPUT_BIG = `
$ ./graph_bench 4194304
N=4194304  layers=10  kernels/step=30  iters=1000  graph nodes=30
stream launches :  6286.80 ms  (209.56 us per kernel)
graph replay    :  6215.18 ms  (207.17 us per kernel)
CPU time spent enqueueing: stream=6075.62 ms  graph=3041.77 ms
speedup         : 1.01x
TEST PASSED  (mismatches=0, max |stream-graph|=0)
`;

const UPDATE_CODE = `
// Change the kernel arguments of an existing graph without re-capturing.
// Works as long as the graph *topology* (nodes + edges) stays the same.
cudaGraph_t newGraph;
cudaStreamBeginCapture(s, cudaStreamCaptureModeGlobal);
run_step(s, d_other_buffer, N, LAYERS);     // same shape, different pointer
cudaStreamEndCapture(s, &newGraph);

cudaGraphExecUpdateResultInfo info;
cudaGraphExecUpdate(exec, newGraph, &info); // patches exec in place, much cheaper than Instantiate
cudaGraphDestroy(newGraph);
`;

export default function CudaGraphsPost() {
  return (
    <article className="max-w-3xl mx-auto">
      <P>
        Here is a thing that surprised me the first time I measured it: a CUDA kernel that does
        almost nothing still costs you around ten microseconds to launch. Not to run. To <em>launch</em>.
        The GPU might finish the actual work in under two microseconds and then just sit there,
        waiting for the CPU to get around to the next launch.
      </P>
      <P>
        If your program launches a handful of big kernels, you will never notice. If it launches
        thousands of small ones in a loop, which is what every inference engine, every physics step,
        and every iterative solver ends up doing, that launch tax quietly becomes the biggest line
        item in your profile. CUDA Graphs exist to make it go away.
      </P>
      <P>
        This post walks through one real program, start to finish, on the laptop I am typing on.
        We will write a tiny pipeline, time it the normal way, turn it into a graph, time it again,
        and prove with a test that we got the same answer. Along the way there are two animations
        you can step through, because &quot;the CPU records the launches instead of executing them&quot; is a
        sentence that only clicks once you have watched it happen.
      </P>

      <H2>The problem: the launch tax</H2>
      <P>
        Every time you write <C>kernel&lt;&lt;&lt;grid, block&gt;&gt;&gt;(args)</C>, the CPU has to do real work.
        It validates arguments, packs them into a command buffer, talks to the driver, and the
        driver talks to the GPU. On Linux this is usually a few microseconds. On Windows, with the
        WDDM driver model, it is often more. On my machine it averaged just over eleven.
      </P>
      <P>
        The GPU, meanwhile, cannot start a kernel until the launch command arrives. So if your
        kernels are shorter than your launches, you end up in the situation below: a CPU that is
        flat out busy, and a GPU that is mostly idle. Hit RUN and watch the hatched gaps.
      </P>

      <Figure
        title="Animation 1 · CPU vs GPU timeline"
        caption="Switch between A and B. The bar lengths are taken from the measured run: ~11 µs per plain launch, ~1 µs per node for a graph launch, ~1.7 µs of GPU time per kernel. Six kernels shown; the real program does thirty per step."
      >
        <LaunchTimelineSimulation />
      </Figure>

      <P>
        In mode A the GPU is busy roughly 15% of the time. In mode B it is busy roughly 60%, and the
        whole thing finishes about four times sooner. Nothing about the kernels changed. We only
        changed how they were handed to the GPU.
      </P>

      <H2>The example program</H2>
      <P>
        To keep things honest I wanted something that looks like real code, not a microbenchmark
        that launches an empty kernel. So here is a very small &quot;neural network&quot;: ten layers, each
        made of a scale, a bias add, and a ReLU. Three kernels per layer, thirty per step. Deliberately
        boring kernels so that launch cost dominates.
      </P>
      <CodeBlock code={PIPELINE_CODE} language="cuda" title="graph_bench.cu — the pipeline" />
      <P>
        We run <C>run_step</C> a thousand times on a buffer of 16,384 floats. Why 16,384? Because
        it is small enough that each kernel takes about two microseconds. That is the regime where
        graphs shine, and later we will deliberately break that assumption to see what happens.
      </P>

      <H3>Run A: the normal way</H3>
      <CodeBlock code={STREAM_CODE} language="cuda" title="graph_bench.cu — plain stream launches" />
      <P>
        Thirty thousand kernel launches, all on one stream, timed with CUDA events so we measure
        GPU-side elapsed time. We also wrap the loop in a wall-clock timer on the CPU side, because
        the comparison between those two numbers is going to tell us something interesting.
      </P>

      <H2>What a CUDA Graph actually is</H2>
      <P>
        A CUDA Graph is a description of GPU work as a set of nodes with dependencies between them.
        A node can be a kernel, a memcpy, a memset, a host callback, or even another graph. The
        edges say &quot;this node must finish before that one starts.&quot;
      </P>
      <Quote>
        The analogy I keep coming back to: a normal launch is phoning the kitchen with each
        instruction. A graph is writing down the whole recipe once and handing it over. The
        kitchen can read ahead.
      </Quote>
      <P>
        Because the GPU gets the entire plan up front, two things become possible. First, the CPU
        side cost collapses: one launch call instead of thirty. Second, the driver can do the
        dependency bookkeeping once, at <em>instantiate</em> time, instead of on every launch.
      </P>
      <P>
        There are two ways to build a graph. You can construct nodes by hand with
        <C>cudaGraphAddKernelNode</C> and friends, which is precise and verbose. Or you can use
        <B>stream capture</B>, which is what almost everyone does: put a stream into recording mode,
        run your existing code, and stop recording. The code you already have becomes the graph.
      </P>

      <H3>Run B: capture once, replay</H3>
      <CodeBlock code={GRAPH_CODE} language="cuda" title="graph_bench.cu — stream capture" />
      <P>
        Notice that <C>run_step</C> is called exactly the same way. The only difference is that it
        sits between <C>cudaStreamBeginCapture</C> and <C>cudaStreamEndCapture</C>. During capture
        the launches are not executed. If you put a <C>printf</C> inside one of those kernels it will
        not print. Step through the animation below and watch the GPU lane stay empty until the
        very first <C>cudaGraphLaunch</C>.
      </P>

      <Figure
        title="Animation 2 · Capture → instantiate → launch"
        caption="One layer shown (three kernels) to keep the diagram readable. The real graph has 30 nodes, which is what the program printed: graph nodes=30."
      >
        <GraphCaptureSimulation />
      </Figure>

      <P>
        The three objects you end up juggling are worth naming clearly, because the API names are
        easy to blur together:
      </P>
      <ul className="space-y-2 mb-6 ml-4">
        <li className="text-[#5e4a30] text-sm leading-relaxed list-disc"><B>cudaStream_t</B>: the tape recorder. During capture it stops being a work queue and becomes a listener.</li>
        <li className="text-[#5e4a30] text-sm leading-relaxed list-disc"><B>cudaGraph_t</B>: the recording. Editable, inspectable, but not runnable.</li>
        <li className="text-[#5e4a30] text-sm leading-relaxed list-disc"><B>cudaGraphExec_t</B>: the compiled, runnable version. This is what you launch, and it is the one you should create once and keep.</li>
      </ul>

      <H2>The test case</H2>
      <P>
        Faster is worthless if it is wrong, so before looking at timings the program checks three
        things against each other: the output of the stream version, the output of the graph
        version, and a plain C loop on the CPU doing the identical arithmetic.
      </P>
      <CodeBlock code={TEST_CODE} language="cuda" title="graph_bench.cu — correctness check" />
      <P>
        The stream and graph outputs should be <em>bit-identical</em>, not just close, because they run
        the same kernels in the same order on the same data. The CPU comparison uses a relative
        tolerance since the CPU may fuse or reorder float ops differently. The math is chosen so the
        values converge to a nonzero fixed point (ten, as it happens), which means a bug that zeroed
        the buffer could not sneak through.
      </P>

      <H2>The run</H2>
      <P>Compile, run, read. This is unedited output from an RTX 3050 laptop GPU, CUDA 12.6, Windows 11.</P>
      <CodeBlock code={OUTPUT_SMALL} language="bash" title="terminal" showLineNumbers={false} />

      <Figure title="Measured · GPU elapsed time, 30,000 kernels" caption="Grey is plain stream launches, black is graph replay. Across five runs the stream number moved between 310 and 400 ms depending on what else Windows was doing; the graph number stayed within 1 ms of 52.">
        <ResultBars />
      </Figure>

      <P>Three things are worth pulling out of that output.</P>
      <P>
        <B>The speedup is 6.4×</B> for the small case, with zero mismatches. Same answer, a sixth of
        the time.
      </P>
      <P>
        <B>The CPU enqueue time equals the GPU elapsed time in run A.</B> 334.5 versus 334.5. That is
        the smoking gun. The GPU finished each kernel the instant it arrived and then waited for the
        next one. It was never the bottleneck. The CPU was.
      </P>
      <P>
        <B>In run B the GPU time per kernel is 1.74 µs.</B> That is roughly what a 16K-element
        elementwise kernel actually costs to execute on this chip. In other words, with the graph
        we are now bounded by real work, which is the best outcome you can hope for.
      </P>

      <H2>When it does nothing</H2>
      <P>
        Now the part people skip. I reran the same binary with N = 4,194,304, so each kernel does 256×
        more work.
      </P>
      <CodeBlock code={OUTPUT_BIG} language="bash" title="terminal" showLineNumbers={false} />
      <P>
        1.01×. A rounding error. Each kernel now takes about 208 µs to execute, which dwarfs an 11 µs
        launch, so the launch cost was already hidden behind the previous kernel&apos;s execution. The
        CPU still saved 3 seconds of its own time, which matters if that thread has other things to
        do, but the GPU timeline did not move.
      </P>
      <Quote>
        Rule of thumb: graphs help when kernel duration is comparable to or shorter than launch
        overhead. If your kernels run for hundreds of microseconds, fix something else first.
      </Quote>

      <H2>Graphs are not only chains</H2>
      <P>
        Our example captured one stream, so the graph was a straight line. If you fork work across
        multiple streams during capture, using events to express the dependencies, the graph records
        that shape too. Independent branches can then overlap on the GPU without you writing any
        extra scheduling code.
      </P>
      <Figure title="Fork/join graph captured from two streams" caption="load runs first, normalize and compute_mask run on two streams and overlap, apply waits for both. The capture records the events as edges.">
        <ForkJoinDag />
      </Figure>

      <H2>Things that will bite you</H2>
      <P>A short list of the mistakes I made so that you do not have to.</P>
      <ul className="space-y-3 mb-6 ml-4">
        <li className="text-[#5e4a30] text-sm leading-relaxed list-disc">
          <B>No synchronisation inside a capture.</B> <C>cudaDeviceSynchronize</C>, <C>cudaStreamSynchronize</C>,
          or a blocking <C>cudaMemcpy</C> on the capturing stream will fail the capture with
          <C>cudaErrorStreamCaptureUnsupported</C>. Use async variants and events.
        </li>
        <li className="text-[#5e4a30] text-sm leading-relaxed list-disc">
          <B>Arguments are frozen.</B> Pointers and scalars are baked into the nodes at capture time.
          If the next iteration needs a different buffer, either write to the same buffer every time
          (the usual trick), or update the exec in place, shown below.
        </li>
        <li className="text-[#5e4a30] text-sm leading-relaxed list-disc">
          <B>Instantiate is expensive.</B> On this machine it took 220 to 340 µs for 30 nodes, which
          is four to six whole replays. Never instantiate inside the loop you are trying to speed up.
        </li>
        <li className="text-[#5e4a30] text-sm leading-relaxed list-disc">
          <B>The first launch is slower.</B> The driver uploads the graph to the device on first use.
          I measured about 300 µs for launch plus sync the first time and about 66 µs every time after.
          Warm it up once before timing.
        </li>
        <li className="text-[#5e4a30] text-sm leading-relaxed list-disc">
          <B>Capture mode matters.</B> <C>cudaStreamCaptureModeGlobal</C> is the safe default: it forbids
          unsafe calls from any thread while capturing. Use <C>ThreadLocal</C> or <C>Relaxed</C> only once you know why you need them.
        </li>
        <li className="text-[#5e4a30] text-sm leading-relaxed list-disc">
          <B>Allocations inside capture</B> need <C>cudaMallocAsync</C>, which turns into a memory node.
          Plain <C>cudaMalloc</C> is not capturable.
        </li>
      </ul>

      <H3>Changing arguments without re-instantiating</H3>
      <CodeBlock code={UPDATE_CODE} language="cuda" title="cudaGraphExecUpdate" />

      <H2>Try it yourself</H2>
      <P>
        The full program is about 100 lines and needs nothing beyond the CUDA toolkit. Build with
        <C>nvcc -O2 -arch=sm_XX graph_bench.cu</C>, substituting your GPU&apos;s compute capability,
        and run it with different N on the command line. Two experiments are worth doing:
      </P>
      <ol className="space-y-2 mb-6 ml-4">
        <li className="text-[#5e4a30] text-sm leading-relaxed list-decimal">Sweep N from 1,024 up to 16,777,216 and find the crossover where the speedup drops to 1×. That number is your launch overhead expressed in &quot;elements of work&quot;.</li>
        <li className="text-[#5e4a30] text-sm leading-relaxed list-decimal">Run the same binary on Linux if you have it. The stream number will drop noticeably because the driver path is shorter, and the graph number will barely move. That gap is the WDDM tax.</li>
      </ol>

      <H2>Takeaways</H2>
      <ul className="space-y-2 mb-6 ml-4">
        <li className="text-[#5e4a30] text-sm leading-relaxed list-disc">Launching a kernel costs CPU time, roughly 3 to 12 µs depending on OS and driver. Short kernels in long loops are dominated by it.</li>
        <li className="text-[#5e4a30] text-sm leading-relaxed list-disc">A CUDA Graph records the work once and replays it with a single call. Capture with <C>cudaStreamBeginCapture</C>, bake with <C>cudaGraphInstantiate</C>, replay with <C>cudaGraphLaunch</C>.</li>
        <li className="text-[#5e4a30] text-sm leading-relaxed list-disc">On a real pipeline of 30 small kernels the measured speedup was 6.4× with bit-identical results. On big kernels it was 1.01×. Measure your kernel duration before reaching for graphs.</li>
        <li className="text-[#5e4a30] text-sm leading-relaxed list-disc">If the CPU enqueue time equals your GPU elapsed time, your GPU is starving. That single comparison is the cheapest diagnostic you will ever run.</li>
      </ul>
    </article>
  );
}
