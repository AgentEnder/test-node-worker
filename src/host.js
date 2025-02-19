//@ts-check
const log = require("why-is-node-running"); // should be your first require

const { spawn } = require("child_process");
const { join } = require("path");
const {
  getFullOsSocketPath,
  connectToSocket,
  writeMessageToSocket,
  consumeMessagesFromSocket,
  makeLargeJson,
} = require("./socket-utils");

// Just need something to take up some time to verify execution works properly
function fib(n) {
  if (n <= 1) {
    return n;
  }
  return fib(n - 1) + fib(n - 2);
}

let id = process.pid;

async function spawnWorker() {
  function exitHandler() {
    console.log("Exiting host");
    worker.kill("SIGTERM");
    socket.destroy();
    process.exit();
  }

  const socketPath = getFullOsSocketPath(id++);

  const worker = spawn(process.execPath, [join(__dirname, "server.js")], {
    stdio: "inherit",
    env: {
      ...process.env,
      SOCKET_PATH: socketPath,
    },
    detached: true,
    shell: false,
    windowsHide: true,
  });
  worker.unref();

  // console.log("Spawned worker:", worker.pid);

  process.on("exit", exitHandler);
  process.on("SIGINT", exitHandler);

  worker.unref();

  const socket = await connectToSocket(socketPath);

  // console.log("Connected to worker:", worker.pid, "@", socketPath);
  return { socket };
}

async function spawnWorkersInSeries(count) {
  const sockets = [];
  for (let i = 0; i < count; i++) {
    sockets.push(await spawnWorker());
  }
  return sockets;
}

async function spawnWorkersInParallel(count) {
  return Promise.all(Array.from({ length: count }, spawnWorker));
}

async function main() {
  performance.mark("Start Workers -- start");
  const count = 1000;
  const sockets =
    process.env.SERIAL === "true"
      ? await spawnWorkersInSeries(count)
      : await spawnWorkersInParallel(count);
  performance.mark("Start Workers -- end");
  performance.measure(
    "Start Workers",
    "Start Workers -- start",
    "Start Workers -- end"
  );

  // performance.mark("Send Messages -- start");
  // for (const { socket } of sockets) {
  //   await sendMessageAndWaitForResponse(
  //     socket,
  //     { message: "Hello from main", data: makeLargeJson(5) },
  //     (message) => {
  //       console.log("Main received message.");
  //     }
  //   );
  // }
  // performance.mark("Send Messages -- end");
  // performance.measure(
  //   "Send Messages",
  //   "Send Messages -- start",
  //   "Send Messages -- end"
  // );

  await new Promise((resolve) => setTimeout(resolve, 1000));
}

new PerformanceObserver((list) => {
  list.getEntries().forEach((entry) => {
    console.log(
      `${entry.name} duration: ${entry.duration} ms, start: ${
        entry.startTime
      } ms, end: ${entry.startTime + entry.duration} ms`
    );
  });
}).observe({ entryTypes: ["measure"] });

const MAX_MESSAGE_WAIT_TIME = 60 * 1000 * 5;

/**
 *
 * @returns {Promise<void>}
 */
async function sendMessageAndWaitForResponse(socket, message, callback) {
  return new Promise((resolve, rej) => {
    const timeout = setTimeout(() => {
      rej();
    }, MAX_MESSAGE_WAIT_TIME);
    socket.once(
      "data",
      consumeMessagesFromSocket((message) => {
        callback(message);
        clearTimeout(timeout);
        resolve();
      })
    );
    writeMessageToSocket(socket, message);
  });
}

main()
  .then(() => {
    console.log("Main done!");
    //   log(); // logs out active handles that are keeping node running
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
