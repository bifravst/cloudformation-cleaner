# AWS CloudFormation Cleaner

[![GitHub Actions](https://github.com/bifravst/cloudformation-cleaner/workflows/Test%20and%20Release/badge.svg)](https://github.com/bifravst/cloudformation-cleaner/actions)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Renovate](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovatebot.com)
[![@commitlint/config-conventional](https://img.shields.io/badge/%40commitlint-config--conventional-brightgreen)](https://github.com/conventional-changelog/commitlint/tree/master/@commitlint/config-conventional)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier/)
[![ESLint: TypeScript](https://img.shields.io/badge/ESLint-TypeScript-blue.svg)](https://github.com/typescript-eslint/typescript-eslint)

This is a [CDK](https://github.com/aws/aws-cdk) project written in TypeScript
that sets up a CloudFormation stack which cleans up left-over stacks and log
groups from CI runs.

Although your CI tests _should_ clean up after themselves, there still might be
stacks and log groups that get not cleaned up perfectly. This stack runs a
lambda every hour, which deletes stacks and log groups that have a certain
prefix and are older than 24 hours.

## Install

    git clone https://github.com/bifravst/cloudformation-cleaner
    npm ci

## Setup in your CI account

> Note: you should only set this up in an account where every CloudFormation
> stack can be deleted, because this lambda has the permissions to delete
> everything.

    npx cdk deploy --context prefix=my-prefix-

You should specify the prefix your stacks use in the context variable `prefix`.

### Configuration

You can configure the regular expression used to check against a resources names
according to the following table

| Lambda              | SSM Parameter Name                 |
| ------------------- | ---------------------------------- |
| `stack-cleaner`     | `/${stackName}/stackNameRegEx`     |
| `log-group-cleaner` | `/${stackName}/logGroupNameRegEx`  |
| `role-cleaner`      | `/${stackName}/roleNameRegEx`      |
| `buckets-cleaner`   | `/${stackName}/bucketNameRegEx`    |
| `parameter-cleaner` | `/${stackName}/parameterNameRegEx` |

You can configure this from the command line:

```bash
aws ssm put-parameter --name /cloudformation-cleaner/stackNameRegEx --value '^(some-pattern|another-pattern)-' --type String --overwrite
aws ssm put-parameter --name /cloudformation-cleaner/parameterNameRegEx --value '^\/(some-pattern|another-pattern)-' --type String --overwrite
```

## Running from the command line

```bash
npm run clean
```

## Node & NPM

This project requires Node.js `>=24.19.0 <25` and npm `>=12.0.2 <13` (enforced
via `check-node-version` on `npm install` and `npm ci`).

The check is skipped during `npm publish` and `npm pack`, because
`semantic-release` bundles its own npm (`@semantic-release/npm` depends on
`npm@^11.6.2`) and runs the publish with that version rather than the one
installed in CI.

## TypeScript 6 and 7

This repo
[runs TypeScript 6 and 7 side by side](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6.0),
[so that eslint works](https://github.com/typescript-eslint/typescript-eslint/issues/10940#issuecomment-4922812181).
