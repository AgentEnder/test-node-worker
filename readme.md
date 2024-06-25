# Test Worker

Within Nx we needed workers that met the following criteria:

- Workers should shut down automatically when the parent process ends
- Workers should be kept-alive for the duration of the parent process
- Workers should be able to be killed if needed
- Logs from workers should be easily visible, without any kind of log file.
- Workers should be totally separate instances of node. This was needed due to the workers frequently registering things like ts-node, @swc-node, etc to read typescript configuration files or load plugins written in typescript. If they do this and are not totally separate, registering transpilers or otherwise mutating global state caused issues.

The first two criteria combine to give us an easy server communication framework. The client posts messages to the server, which does work and responds to the client. When the client is ready to shutdown, it kills the server.

The third criteria allows us to relaunch workers when we need to, for example if their configuration would have changed.

The fourth criteria is needed to prevent workers from being a downgrade in debugability and UX for existing use cases that work.

## The almost solution: IPC based workers.

Forking a process in node provides an IPC channel that can be used to communicate with the worker. The naive approach is to use this channel to send messages to the worker, and have the worker send messages back. This is a good solution, but it has a big drawback:

- The IPC channel prevents the parent process from exiting until the child process is killed. This is a problem because we want the child process to stay alive until the parent process is done, in case the worker is needed again.

We can "solve" this by explicitly calling process.exit() at the end of the parent process, which would trigger our exit handlers to kill the worker process, but this doesn't work if other libraries use our code under the hood.

## The solution: Socket based workers.

To allow node to exit, we need to detach the built in IPC channel. This is easy, but means we can no longer communicate with the worker. To get communication back, we can utilize a socket.

The socket works by hosting a server in the worker process, and connecting to it from the parent process. This allows us to send messages to the worker, and have the worker send messages back, without preventing the parent process from exiting. When the parent process exits we can kill the worker process, which tears down the socket.

### A minor complication:

To allow the process to exit, the socket needs to be unref'd. This lets node shutdown even if the socket is still open. However, this means that waiting for a message from the worker will not keep the process alive. Setting a timeout for the message is enough to solve this, and probably a good safe-guard regardless.
