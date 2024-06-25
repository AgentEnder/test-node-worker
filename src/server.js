const log = require("why-is-node-running"); // should be your first require
const { mkdirSync, unlinkSync } = require("fs");
const {
  getFullOsSocketPath,
  consumeMessagesFromSocket,
  writeMessageToSocket,
} = require("./socket-utils");

console.log("Hello from worker");

const interval = setInterval(() => {
  console.log("Worker is working");
}, 500);

const exitHandler = (signal) => () => {
  console.log("Exiting worker, recieved:", signal);
  server.close();
  process.exit(0);
};

process.on("exit", exitHandler("exit"));
process.on("SIGINT", exitHandler("SIGINT"));
process.on("SIGTERM", exitHandler("SIGTERM"));

const server = require("net").createServer((socket) => {
  socket.on(
    "data",
    consumeMessagesFromSocket((message) => {
      console.log("Server received message:", message);
      writeMessageToSocket(socket, { message: "Hello from worker" });
    })
  );
});

const socketPath = getFullOsSocketPath();
try {
  mkdirSync(dirname(socketPath), { recursive: true });
} catch {}

server.listen(getFullOsSocketPath());

setTimeout(() => {
  process.exit(0);
}, 5000);
