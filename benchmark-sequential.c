#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/time.h>
#include <time.h>
#include "benchmark-now.h"

void* thread_entry_point(void* ctx) {
  t64 end = now();
  t64 start = *(t64*)ctx;
  printf("%llu\n", end - start);
  return 0;
}

int main(int argc, char* argv[]) {
  if (argc <= 1) {
    printf("Usage: %s [# of threads to spawn sequentially]\n", argv[0]);
    exit(1);
  }

  int n = atoi(argv[1]);
#ifdef DEBUG
  printf("spawning %d threads:\n", n);
#endif
  for (int i = 0; i < n; i++) {
    pthread_t thread;
    t64 start = now();
    int ret = pthread_create(&thread, NULL, &thread_entry_point, (void*)&start);
    if (ret) {
      printf("failed to spawn thread: %s", strerror(ret));
      exit(1);
    }
    pthread_join(thread, NULL);
  }

  return 0;
}
