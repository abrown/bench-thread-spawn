CFLAGS += -O3

# Run calibration to manually check that `benchmark-now.h`'s microsecond timing is roughly accurate.
calibrate: native/benchmark-calibration wasi-threads/benchmark-calibration.wasm emscripten/benchmark-calibration.js
	EXE="native/benchmark-calibration" scripts/calibrate
	EXE="wasi-threads/run wasi-threads/benchmark-calibration.wasm" scripts/calibrate
	EXE="emscripten/run emscripten/benchmark-calibration.js" scripts/calibrate
.PHONY: calibrate
native/benchmark-calibration: benchmark-calibration.c benchmark-now.h
	$(CC) $(CFLAGS) $^ -o $@
wasi-threads/benchmark-calibration.wasm: benchmark-calibration.c benchmark-now.h
	wasi-threads/cc $(CFLAGS) $< -o $@
emscripten/benchmark-calibration.js: benchmark-calibration.c benchmark-now.h
	emscripten/cc $(CFLAGS) $< -o $@

# Build and run the sequential thread-spawning benchmarks.
sequential: native/benchmark-sequential wasi-threads/benchmark-sequential.wasm emscripten/benchmark-sequential.js
	EXE="native/benchmark-sequential" scripts/sequential
	EXE="wasi-threads/run wasi-threads/benchmark-sequential.wasm" scripts/sequential
	EXE="emscripten/run emscripten/benchmark-sequential.js" scripts/sequential
.PHONY: sequential
native/benchmark-sequential: benchmark-sequential.c benchmark-now.h
	$(CC) $(CFLAGS) $^ -o $@
wasi-threads/benchmark-sequential.wasm: benchmark-sequential.c benchmark-now.h
	wasi-threads/cc $(CFLAGS) $< -o $@
emscripten/benchmark-sequential.js: benchmark-sequential.c benchmark-now.h
	emscripten/cc $(CFLAGS) $< -o $@

# Build and run the parallel thread-spawning benchmarks.
parallel: native/benchmark-parallel wasi-threads/benchmark-parallel.wasm emscripten/benchmark-parallel.js
	EXE="native/benchmark-parallel" scripts/parallel
	EXE="wasi-threads/run wasi-threads/benchmark-parallel.wasm" scripts/parallel
	EXE="emscripten/run emscripten/benchmark-parallel.js" scripts/parallel
native/benchmark-parallel: benchmark-parallel.c benchmark-now.h
	$(CC) $(CFLAGS) $^ -o $@
wasi-threads/benchmark-parallel.wasm: benchmark-parallel.c benchmark-now.h
	wasi-threads/cc $(CFLAGS) $< -o $@
emscripten/benchmark-parallel.js: benchmark-parallel.c benchmark-now.h
	emscripten/cc $(CFLAGS) $< -o $@

clean:
	