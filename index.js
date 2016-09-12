'use strict';

const lib = require('./lib');

module.exports = { bootstrap };

function bootstrap(taskDefinition) {
  return lib.getAgentMetadata()
    .then(metadata => lib.parseAgentMetadata(metadata))
    .then(metadata => lib.insureTaskStarts(Object.assign({ taskDefinition }, metadata)));
}
