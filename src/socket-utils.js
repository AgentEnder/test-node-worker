const { tmpdir } = require("os");
const { resolve } = require("path");

const isWindows = process.platform === "win32";

const getFullOsSocketPath = (id) =>
  isWindows
    ? "\\\\.\\pipe\\nx\\" + resolve(tmpdir() + `\\worker${id}.sock`)
    : resolve(tmpdir() + `/worker${id}.sock`);

function consumeMessagesFromSocket(callback) {
  let message = "";
  return (data) => {
    const chunk = data.toString();
    if (chunk.codePointAt(chunk.length - 1) === 4) {
      message += chunk.substring(0, chunk.length - 1);

      // Server may send multiple messages in one chunk, so splitting by 0x4
      const messages = message.split("");
      for (const splitMessage of messages) {
        callback(JSON.parse(splitMessage));
      }

      message = "";
    } else {
      message += chunk;
    }
  };
}

// Tries to connect to a socket at the given path, waiting for it to be available.
/**
 *
 * @param {*} socketPath
 * @returns {Promise<import("net").Socket>}
 */
async function connectToSocket(socketPath) {
  return new Promise((resolve, reject) => {
    const socket = require("net").connect(socketPath, () => {
      resolve(socket);
    });

    socket.unref();

    socket.on("error", (err) => {
      if (err.code === "ENOENT") {
        setTimeout(() => {
          connectToSocket(socketPath).then(resolve, reject);
        }, 100);
      } else {
        reject(err);
      }
    });
  });
}

function writeMessageToSocket(socket, message) {
  socket.write(JSON.stringify(message));
  socket.write(String.fromCharCode(4));
}

function makeLargeJson(maxDepth, depth = 0) {
  const obj = {};
  for (let i = 0; i < 5; i++) {
    obj[i] = depth < maxDepth ? makeLargeJson(maxDepth, depth + 1) : i;
  }
  return obj;
}

module.exports = {
  isWindows,
  getFullOsSocketPath,
  consumeMessagesFromSocket,
  writeMessageToSocket,
  getFullOsSocketPath,
  connectToSocket,
  makeLargeJson,
};
