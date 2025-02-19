const log = require("why-is-node-running"); // should be your first require
const { mkdirSync, unlinkSync } = require("fs");
const {
  getFullOsSocketPath,
  consumeMessagesFromSocket,
  writeMessageToSocket,
  makeLargeJson,
} = require("./socket-utils");

const exitHandler = (signal) => () => {
  // console.log("Exiting worker, recieved:", signal);
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
      console.log("Server received message.", message);
      writeMessageToSocket(socket, {
        message: "Hello from worker",
        data: makeLargeJson(4),
      });
    })
  );
});

const socketPath = process.env.SOCKET_PATH;
try {
  mkdirSync(dirname(socketPath), { recursive: true });
} catch {}

server.listen(socketPath);

setTimeout(() => {
  process.exit(0);
}, 10000);
