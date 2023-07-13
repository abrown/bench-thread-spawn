# `bench-thread-spawn`

This project aims to quantify the overhead of creating threads in various WebAssembly environments.

- As a baseline, it spawns native OS threads ([`native`](./native/))
- Then, we spawn threads in Wasmtime compiled using the `wasm32-wasi-threads` target in wasi-sdk
  ([`wasi-threads`](./wasi-threads/))
- We also spawn threads in NodeJS web workers compiled using Emscripten
  ([`emscripten`](./emscripten/)); we assume that web worker performance in NodeJS is similar
  (identical?) to that of browser web workers
- For some additional data points, we measure the raw cost to start up a web worker in a browser
  ([`manual`](./manual/))--this does not involve compiling any C code

The bottom-line: web worker thread-spawning is __2-3 orders of magnitude slower__ than native or
wasi-threads spawning. See the [results](#results) for more details.

### Calibration

It was not always clear to me that this infrastructure recorded the correct measurements (see, e.g.,
[emscripten#19788](https://github.com/emscripten-core/emscripten/issues/19788)). The timing code in
[`benchmark-now.h`](./benchmark-now.h) is not designed to be particularly precise, but it must have
microsecond precision. To check this, run:

```shell
$ make calibrate
```

This runs the [`calibrate`](scripts/calibrate) driver over the compiled
[`benchmark-calibration.c`](./benchmark-calibration.c) code. One can then visually inspect that the
passed-in value (`> run ... <n>`), the recorded value (`<n>` printed to stdout), and the `time`
output all roughly line up. `n` is microseconds. Do not worry too much about the `n = 1` case (e.g.,
`time` is measuring a bunch of startup overhead) &mdash; all that is important here is that the
printed `n` is some low integer, not `0` or `1000` (as recorded originally with Emscripten).

### Sequential

To gather some measurements for threads spawned sequentially, run:

```shell
$ taskset --cpu-list 0-12 make sequential
```

This runs the [`sequential`](scripts/sequential) driver over the compiled
[`benchmark-sequential.c`](./benchmark-sequential.c) code. The idea here is to spawn `n` threads one
after the other, measuring the time it takes from `pthread_create` in the main thread to the first
instruction being executed in the child thread. This is done for different `n`, attempting to
collect at least 100 samples in the low `n` cases and doing some "check the last 10 samples" for
others.

### Parallel

To gather some measurements for threads spawned in parallel, run:

```shell
$ taskset --cpu-list 0-12 make parallel
```

This runs the [`parallel`](scripts/parallel) driver over the compiled
[`benchmark-parallel.c`](./benchmark-parallel.c) code. The idea here is to spawn `n` threads all
around the same time, again measuring the time it takes from `pthread_create` in the main thread to
the first instruction being executed in the child thread. As with `sequential`, this is done for
different `n`, attempting to collect at least 100 samples in the low `n` cases. Expect the
Emscripten-Node version to fail at a certain point.

### Manual

The [`manual`](./manual/) approach attempts to measure something slightly different than the
previous ones. The Emscripten-compiled versions make use of web workers under the hood, but there
are some confounding variables here (e.g., worker caching? `postMessage` time?). To understand this
better, the [`manual`](./manual/) directory is simpler: it spawns a web worker using JS and uses
`performance.now()` to measure the time for that worker to send a message back. (Though we would
like to, we cannot measure at the first worker instruction because each worker has its own 0-based
time origin &mdash; we have to accept a slight overhead with a `postMessage` back to the main
thread).

This directory runs some experiments in a browser &mdash; see the browser console. It essentially
captures the `sequential` and `parallel` approaches but with slightly different terminology: it uses
the JS `async` and `await` concepts instead. No compilation is required; serve the directory and
open `manual.html` in a browser:

```shell
$ $EMSDK_DIR/upstream/emscripten/emrun --no_browser manual
# open http://localhost:6931
```

### Results

The measurements will vary with system load and this infrastructure's precision is rather rough, but
one can get a general overview of the trends regardless. This table summarizes the mean measurements
(rounded to microseconds) for various `n` measured on my system with no special care taken to
isolate for benchmarking:

|                           |     1 |    10 |    100 | 1000 | 100 (last 10) | 1000 (last 10) |
|---------------------------|-------|-------|--------|------|---------------|----------------|
| `native` sequential       |   110 |    56 |     16 |   10 | 7             | 7              |
| `native` parallel         |    91 |    24 |      6 |    5 | n/a           | n/a            |
| `wasi-threads` sequential |   239 |   133 |     20 |   34 | 15            | 14             |
| `wasi-threads` parallel   |   245 |    67 |     12 |   10 | n/a           | n/a            |
| `emscripten` sequential   | 29817 |  3119 |    336 |   73 | 36            | 182            |
| `emscripten` parallel     | 29570 | 37775 | 409055 | OOM* | n/a           | n/a            |
| `manual` sequential       |  5238 |  2836 |   3188 |  n/a | n/a           | n/a            |
| `manual` parallel         |  9233 | 18661 | 122577 |  n/a | n/a           | n/a            |


Note that this data is _very_ noisy and prone to variation; you may see different results on your
system. But I notice several trends:
- First, __the first few threads spawned take longer__. I added the two-right hand columns to
  eliminate the skewing from the slower early spawns &mdash; these columns cut off all earlier data
  except the last 10 spawns from `n` threads spawned sequentially. In general with sequential
  spawning, the more threads we spawn, the less time they take (except for `emscripten` with `n =
  1000`?)
- Secondly, one might conclude that, eventually, __wasi-threads are only about 2-3x slower to spawn
  than native ones__.
- Glancing at `manual` and `emscripten`, we can see __differences of 2-3 orders of magnitude__
  versus `native` and `wasi-threads`. This trend is only bucked `emscripten` sequential: I suspect
  that Emscripten here reuses the same web worker repeatedly to avoid the high cost of spawning a
  web worker thread. In scenarios where it cannot do this, it just has to be at least the base cost
  (see `manual`) plus some Emscripten overhead.
- One might wonder: can we move the cost of spawning a web worker somewhere else? Emscripten has a
  `-sPTHREAD_POOL_SIZE` flag to spawn a pool of web workers so that later `pthread_create` calls are
  faster. But note that the high cost is payed somewhere (earlier in the application lifetime, sure)
  and that not all applications will fit neatly into this paradigm.

### Summary

Thread spawning via web workers is much slower than native thread spawning, even with some WASI
overhead thrown in. At the lower limit subtracting Emscripten's overhead (i.e., `manual`), there's
roughly a __~200x slowdown__ (at `n = 100`, 3188 / 16). With Emscripten's thread-caching tricks (and
only spawning the "right" number of threads--don't look at parallel!), there's roughly a __~7x
slowdown__ (`at n = 1000`, 73 / 10). In the worst case, spawning 100 threads in parallel, there's
roughly a __~68000x__ slowdown (at `n = 100`, 409055 / 6). All of these differences, picked rather
arbitrarily, are meant to illustrate the point: actually spawning new web worker threads can be
_very_ slow.
