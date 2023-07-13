console.log('[parent] time at execution start: ', performance.now());
const sleep = ms => new Promise(r => setTimeout(r, ms));
const mean = array => array.reduce((a, b) => a + b) / array.length;
const min = array => Math.min(...array);
const max = array => Math.max(...array);
const stats = array => { return { len: array.length, min: min(array), mean: mean(array), max: max(array) } };

(async () => {
    // Control.
    const controlStart = performance.now();
    await sleep(10); // ms
    const controlEnd = performance.now();
    console.log('[parent] a 10ms timeout elapsed in: ', controlEnd - controlStart);

    // Experiments.
    await experiment(1);
    await experiment(10);
    await experiment(100);
})();

async function experiment(batchSize) {
    console.log('with batch size = ', batchSize);
    const workerSamples = await sample(() => newWorker(batchSize));
    console.log('[parent] new worker: ', JSON.stringify(workerSamples));
    const pongSamples = await sample(async () => await justPong(batchSize));
    console.log('[parent] new worker + pong: ', JSON.stringify(pongSamples));
    const syncPongSamples = await sample(async () => await justPongSync(batchSize));
    console.log('[parent] new worker + pong (sync): ', JSON.stringify(syncPongSamples));
    // console.log('[parent] new worker + ping + pong: ', await sample(async () => await pingPong(batchSize)));
    // console.log('[parent] new worker + ping + pong (sync): ', await sample(async () => await pingPongSync(batchSize)));
}

async function sample(fn, _numSamples) {
    const numSamples = _numSamples || 100;
    const samples = [];
    while (samples.length < numSamples) {
        const _samples = await fn();
        samples.push(..._samples);
    }
    return stats(samples);
}

function newWorker(batchSize) {
    const samples = [];
    for (let n = 0; n < batchSize; n++) {
        const start = performance.now();
        let _ = new Worker('manual-immediate.js');
        const end = performance.now();
        samples.push(end - start);
    }
    return samples;
}

async function justPong(batchSize) {
    const samples = [];
    for (let n = 0; n < batchSize; n++) {
        const start = performance.now();
        let worker = new Worker('manual-immediate.js');
        worker.addEventListener('message', (e) => {
            const end = performance.now();
            samples.push(end - start);
        });
    }
    while (samples.length < batchSize) {
        await sleep(1);
    }
    return samples;
}

async function justPongSync(batchSize) {
    const samples = [];
    for (let n = 0; n < batchSize; n++) {
        await new Promise(done => {
            const start = performance.now();
            let worker = new Worker('manual-immediate.js');
            worker.addEventListener('message', (e) => {
                const end = performance.now();
                samples.push(end - start);
                done();
            });
        });
    }
    console.assert(samples.length == batchSize);
    return samples;
}

async function pingPong(batchSize) {
    const samples = [];
    for (let n = 0; n < batchSize; n++) {
        const start = performance.now();
        let worker = new Worker('manual-onmessage.js');
        worker.postMessage([]);
        worker.addEventListener('message', (e) => {
            const end = performance.now();
            samples.push(end - start);
        });
    }
    while (samples.length < batchSize) {
        await sleep(1);
    }
    return samples;
}

async function pingPongSync(batchSize) {
    const samples = [];
    for (let n = 0; n < batchSize; n++) {
        await new Promise(done => {
            const start = performance.now();
            let worker = new Worker('manual-onmessage.js');
            worker.postMessage([]);
            worker.addEventListener('message', (e) => {
                const end = performance.now();
                samples.push(end - start);
                done();
            });
        });
    }
    console.assert(samples.length == batchSize);
    return samples;
}

// This was useful to double-check that the functions above were not influencing the results:
//
// const start = performance.now();
// let worker = new Worker('manual-onmessage.js');
// worker.postMessage([]);
// worker.addEventListener('message', (e) => {
//     const end = performance.now();
//     console.log('[parent] immediate ping elapsed: ', end - start);
// });

