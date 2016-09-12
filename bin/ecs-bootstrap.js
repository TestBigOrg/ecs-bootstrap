#!/usr/bin/env node

/* eslint-disable no-console */

const bootstrap = require('..').bootstrap;
const taskDefinition = process.argv[2];

if (!taskDefinition) {
  console.error('ERROR: no task definition specified');
  process.exit(1);
}

bootstrap(taskDefinition)
  .then(() => console.log(`Successfully started ${taskDefinition}`))
  .catch(err => {
    console.error(err.stack);
    process.exit(1);
  });
