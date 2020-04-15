// Use to stop nodejs cleanly.
'use strict';

// import createNsLogger from './logger.mjs'
// const logger = createNsLogger('graceful')

const onExitMethods = new Set();

// Ensure this program won't be running after maxShutdownTime seconds no matter what
const ensureStop = maxShutdownTime =>
  setTimeout(() => {
    // logger.error('Could not stop the process in time', {maxShutdownTime});
    process.exit(1);
  }, maxShutdownTime * 1000)
    // We call unref so that the timeout does not prevent node from exiting
    .unref()
;

// Try to stop the server gracefully by executing tasks designed to make it go away properly
// but ensure it terminates if this don't work
const terminate = async({autoExit = false, exitCode = 0, maxShutdownTime = 30}, exit) => {
  // We do not want any listeners from preventing the process to terminate anymore
  process.removeAllListeners();

  // Graceful stop should not take more than maxShutdownTime seconds, if it does
  // stops the process the hard way
  ensureStop(maxShutdownTime);

  const errors = [];

  if (exit instanceof Error)
    errors.push(exit);

  // Run all tasks, ensuring all tasks can run to their completing even if one of them fails
  // but keep track of all errors that happened during this process
  // logger.info('Running graceful stop tasks…');
  await Promise.all([...onExitMethods].map(async method => {
    try {
      await method();
    }
    catch (err) {
      errors.push(err);
    }
  }));
  // logger.info('Tasks executed properly!');
  // If we have at least one error, we can't stop with a 0 exit code
  // so we print the error(s) and then we exit with 1 except if we have
  // another exit code that was provided to us (that is not 0)
  if (errors.length > 0) {
    // logger.error('Errors happened during stop!');
    errors.forEach(err => console.error(err));
    process.exit(exitCode || 1);
  }
  else {
    // logger.info('All shutdown tasks ran sucessfully. The server should be stopping now!');
  }

  // Some event do not cause exit if catched, so we need to restore that
  // behavior by exiting ourselves
  if (autoExit)
    process.exit(exitCode);
};


const gracefulStop = {}
gracefulStop.do = method => onExitMethods.add(method);
gracefulStop.undo = method => onExitMethods.delete(method);
gracefulStop.install = options => {
  process.once('beforeExit', terminate);
  process.on('SIGTERM', terminate.bind(null, {...options, autoExit: true}));
  process.on('SIGINT', terminate.bind(null, {...options, autoExit: true}));
  process.on('SIGUSR1', terminate.bind(null, {...options, autoExit: true}));
  process.on('SIGUSR2', terminate.bind(null, {...options, autoExit: true}));
  process.on('uncaughtException', terminate.bind(null, {...options, autoExit: true, exitCode: 1}));
  process.on('unhandledRejection', terminate.bind(null, {...options, autoExit: true, exitCode: 1}));
};


export default gracefulStop
