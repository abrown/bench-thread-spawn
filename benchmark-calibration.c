#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include "benchmark-now.h"

int main(int argc, char* argv[]) {
  assert(sizeof(t64) == 8);

  if (argc <= 1) {
    printf("Usage: %s [# of microseconds to sleep]\n", argv[0]);
    exit(1);
  }

  int n = atoi(argv[1]);
  t64 start = now();
  usleep(n);  // n microseconds.
  t64 end = now();
  printf("%llu\n", end - start);

  return 0;
}
