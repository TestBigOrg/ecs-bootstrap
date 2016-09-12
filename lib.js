'use strict';

const http = require('http');
const AWS = require('aws-sdk');
const assert = require('assert');

module.exports = { getAgentMetadata, parseAgentMetadata, insureTaskStarts };

function getAgentMetadata() {
  const url = 'http://localhost:51678/v1/metadata';
  const pause = 2000;
  const maxAttempts = 10;
  let attempts = 0;

  function get(attempts, resolve, reject) {
    attempts++;

    function failed(err) {
      if (attempts < maxAttempts) return setTimeout(get, pause, attempts, resolve, reject);
      else return reject(err);
    }

    http.get(url, res => {
      if (res.statusCode !== 200)
        return failed(new Error(`Could not connect to ecs-agent after ${maxAttempts} attempts`));

      let data = '';
      res.on('error', err => failed(err));
      res.on('data', d => data += d);
      res.on('end', () => resolve(data));
    });
  }

  return new Promise((resolve, reject) => get(attempts, resolve, reject));
}

function parseAgentMetadata(metadata) {
  metadata = JSON.parse(metadata);
  const containerInstanceArn = metadata.ContainerInstanceArn;
  assert.ok(containerInstanceArn);
  const region = containerInstanceArn.split(':')[3];
  assert.ok(region);
  const cluster = metadata.Cluster;
  assert.ok(cluster);
  const ecs = new AWS.ECS({ region });

  return { containerInstanceArn, cluster, region, ecs };
}

function insureTaskStarts(options) {
  const pause = 1000;
  const maxAttempts = 10;
  let attempts = 0;

  function start(attempts, resolve, reject) {
    attempts++;

    startTask(options).then(options => waitFor(options))
      .then(() => resolve())
      .catch(err => {
        if (attempts < maxAttempts) return setTimeout(start, pause, attempts, resolve, reject);
        reject(err);
      });
  }

  return new Promise((resolve, reject) => start(attempts, resolve, reject));
}

function startTask(options) {
  return options.ecs.startTask({
    cluster: options.cluster,
    taskDefinition: options.taskDefinition,
    containerInstances: [options.containerInstanceArn],
    startedBy: 'ecs-bootstrap'
  }).promise().then(data => {
    if (data.tasks.length) return Object.assign({ taskArn: data.tasks[0].taskArn }, options);

    const reason = data.failures.length ? data.failures[0].reason : 'Failed to start task';
    throw new Error(reason);
  });
}

function waitFor(options) {
  return options.ecs.waitFor('tasksRunning', {
    tasks: [options.taskArn],
    cluster: options.cluster
  }).promise();
}
