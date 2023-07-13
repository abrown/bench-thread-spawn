#include <sys/time.h>
#include <time.h>

// We want to be able to build these benchmarks using various compilers,
// including Emscripten.
#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#endif

// We manually specify the type we will use for time measurements. We really
// want to make sure that a full 8 bytes are used to avoid overflow; this can be
// a problem with WebAssembly's interpretation of `long` as `i32`:
// https://github.com/WebAssembly/tool-conventions/blob/main/BasicCABI.md#data-representation.
typedef unsigned long long t64;

// Return some number of microseconds representing "now". Time 0 is different in
// different contexts so we try to paper over the differences between them.
t64 now() {
#ifdef __EMSCRIPTEN__
  double now = emscripten_get_now();
  return (t64)(now * 1000);  // Drop anything under microsecond precision.
#else
  struct timeval tv;
  gettimeofday(&tv, NULL);
  return 1000000 * (t64)tv.tv_sec + (t64)tv.tv_usec;
#endif
}
