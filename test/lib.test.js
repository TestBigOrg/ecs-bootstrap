'use strict';

const http = require('http');
const events = require('events');
const AWS = require('aws-sdk');
const test = require('tape');
const sinon = require('sinon');
const lib = require('../lib');

test('[getAgentMetadata] cannot connect', assert => {
  const get = sinon.stub(http, 'get');
  get.yieldsAsync({ statusCode: 404 });

  lib.getAgentMetadata()
    .then(() => {
      assert.fail('Should not resolve');
      get.restore();
      assert.end();
    })
    .catch(err => {
      assert.equal(err.message, 'Could not connect to ecs-agent after 10 attempts', 'expected error message');
      assert.equal(get.callCount, 10, 'attempted 10 times');
      get.restore();
      assert.end();
    });
});

test('[getAgentMetadata] connection failure', assert => {
  const get = sinon.stub(http, 'get', (url, callback) => {
    const res = new events.EventEmitter();
    res.statusCode = 200;
    setImmediate(res.emit.bind(res), 'error', new Error('Connection failure'));
    callback(res);
  });

  lib.getAgentMetadata()
    .then(() => {
      assert.fail('Should not resolve');
      get.restore();
      assert.end();
    })
    .catch(err => {
      assert.equal(err.message, 'Connection failure', 'expected error message');
      assert.equal(get.callCount, 10, 'attempted 10 times');
      get.restore();
      assert.end();
    });
});

test('[getAgentMetadata] success', assert => {
  const res = new events.EventEmitter();
  res.statusCode = 200;
  setTimeout(() => {
    res.emit('data', 'got the');
    res.emit('data', ' memo');
    res.emit('end');
  }, 500);

  const get = sinon.stub(http, 'get');
  get.yieldsAsync(res);

  lib.getAgentMetadata()
    .then(data => {
      assert.equal(data, 'got the memo', 'got metadata');
      get.restore();
      assert.end();
    })
    .catch(err => {
      assert.ifError(err, 'failed');
      get.restore();
      assert.end();
    });
});

test('[parseAgentMetadata]', assert => {
  const valid = JSON.stringify({
    ContainerInstanceArn: 'arn:aws:ecs:us-east-1:123456789012:container-instance/60693afc-e694-4da9-92d6-c27dcb27d182',
    Cluster: 'ecs-cluster-testing'
  });

  const cannotParse = '{"whoops';
  const noArn = JSON.stringify({ Cluster: 'ecs-cluster-testing' });

  const badArn = JSON.stringify({
    ContainerInstanceArn: 'arn:a9-92d6-c27dcb27d182',
    Cluster: 'ecs-cluster-testing'
  });

  const noCluster = JSON.stringify({
    ContainerInstanceArn: 'arn:aws:ecs:us-east-1:123456789012:container-instance/60693afc-e694-4da9-92d6-c27dcb27d182'
  });

  var original = AWS.ECS;
  var ecs = sinon.stub();
  ecs.returns({ mock: 'client' });
  AWS.ECS = ecs;

  assert.deepEqual(lib.parseAgentMetadata(valid), {
    region: 'us-east-1',
    ecs: { mock: 'client' },
    cluster: 'ecs-cluster-testing',
    containerInstanceArn: 'arn:aws:ecs:us-east-1:123456789012:container-instance/60693afc-e694-4da9-92d6-c27dcb27d182',
  }, 'parsed valid metadata');

  assert.ok(ecs.calledWith({ region: 'us-east-1' }), 'created ecs client in correct region');

  assert.throws(() => lib.parseAgentMetadata(cannotParse), 'throws on non-JSON metadata');
  assert.throws(() => lib.parseAgentMetadata(noArn), 'throws on metadata without ContainerInstanceArn');
  assert.throws(() => lib.parseAgentMetadata(badArn), 'throws on metadata with malformed ContainerInstanceArn');
  assert.throws(() => lib.parseAgentMetadata(noCluster), 'throws on metadata with no Cluster');

  AWS.ECS = original;
  assert.end();
});

test('[insureTaskStarts] success', assert => {
  const client = new AWS.ECS({ region: 'us-east-1' });
  const start = sinon.stub(client, 'startTask');
  start.returns({
    promise: () => Promise.resolve({ tasks: [{ taskArn: 'abcd' }] })
  });
  const waitFor = sinon.stub(client, 'waitFor');
  waitFor.returns({
    promise: () => Promise.resolve()
  });

  const options = {
    cluster: 'my-cluster',
    taskDefinition: 'my-task-definition',
    containerInstanceArn: 'my-container-instance-arn',
    ecs: client
  };

  lib.insureTaskStarts(options).then(() => {
    assert.equal(start.callCount, 1, 'called startTask once');
    assert.ok(start.calledWith({
      cluster: options.cluster,
      taskDefinition: options.taskDefinition,
      containerInstances: [options.containerInstanceArn],
      startedBy: 'ecs-bootstrap'
    }), 'called startTask correctly');

    assert.equal(waitFor.callCount, 1, 'called waitFor once');
    assert.ok(waitFor.calledWith('tasksRunning', {
      tasks: ['abcd'],
      cluster: options.cluster
    }), 'called waitFor correctly');
    assert.end();
  }).catch(err => {
    assert.ifError(err, 'failed');
    assert.end();
  });
});
