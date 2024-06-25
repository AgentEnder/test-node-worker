//@ts-check
const log = require("why-is-node-running"); // should be your first require

const { fork } = require("child_process");
const { join } = require("path");
const {
  getFullOsSocketPath,
  connectToSocket,
  writeMessageToSocket,
  consumeMessagesFromSocket,
} = require("./socket-utils");

// Just need something to take up some time to verify execution works properly
function fib(n) {
  if (n <= 1) {
    return n;
  }
  return fib(n - 1) + fib(n - 2);
}

async function spawnWorker() {
  function exitHandler() {
    console.log("Exiting host");
    worker.kill("SIGTERM");
    socket.destroy();
  }

  const worker = fork(join(__dirname, "./server.js"), {
    stdio: "inherit",
    detached: true,
  });

  console.log("Spawned worker:", worker.pid);

  process.on("exit", exitHandler);
  process.on("SIGINT", exitHandler);

  worker.disconnect();
  worker.unref();

  const socket = await connectToSocket(getFullOsSocketPath());
  return { socket };
}

async function main() {
  const { socket } = await spawnWorker();

  await sendMessageAndWaitForResponse(
    socket,
    { message: "Hello from main" },
    (message) => {
      console.log("Main received message:", message);
    }
  );

  fib(42);
  console.log("Main thread done!");
}

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
