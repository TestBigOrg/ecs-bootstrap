# ecs-bootstrap

Run a specific task definition on the EC2 this command is executed from. Put a call to `ecs-bootstrap` into your EC2's `UserData` script to insure that a task is started when the EC2s starts up.

## Prerequisites

- The EC2 must have node.js and npm installed
- The EC2 must be running the AWS ecs-agent
- The EC2 must have IAM permissions to `ecs:StartTask` and `ecs:DescribeTasks`

  ```json
  {
    "Action": [
      "ecs:StartTask",
      "ecs:DescribeTasks"
    ],
    "Effect": "Allow",
    "Resource": [
      "arn:aws:ecs:us-east-1:123456789012:task-definition/my-task-definition:*"
    ]
  }
  ```

## Features

- Makes up to 10 attempts to connect to the ecs-agent over 20 seconds before failing
- Makes an API call to start the desired task, then polls the ECS API until the task is running, waiting up to 10 minutes
- Makes up to 10 attempts to start the tasks

## Usage

```
$ npm install -g ecs-bootstrap
$ ecs-bootstrap my-task-definition
```
