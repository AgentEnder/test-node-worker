const { exec, execSync } = require("child_process");
const { dim } = require("chalk");

// Start host process
const child = exec("node index.js");

// Read worker pid from stdout
let workerPid;
child.stdout.on("data", (data) => {
  process.stdout.write(dim(data.toString()));
  const line = data.toString().trim();
  if (line.startsWith("Spawned worker:")) {
    const pid = line.split(":")[1].trim();
    workerPid = pid;
    console.log("Found worker pid:", pid);
  }
});
child.stderr.on("data", (data) => {
  process.stderr.write(dim(data.toString()));
});

// Verify worker was shutdown.
child.on("exit", (code) => {
  console.log(`Child exited with code ${code}`);
  if (workerPid) {
    // check if worker is still running
    try {
      execSync("ps -p " + workerPid + " -o comm=");
      console.log("Worker is still running,", workerPid);
    } catch {
      console.log("Worker shutdown successfully");
      return;
    }
  }
});
