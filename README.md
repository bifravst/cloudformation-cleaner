# AWS CloudFormation Cleaner

[![GitHub Actions](https://github.com/NordicSemiconductor/cloud-aws-cloudformation-cleaner-js/workflows/Test%20and%20Release/badge.svg)](https://github.com/NordicSemiconductor/cloud-aws-cloudformation-cleaner-js/actions)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Renovate](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovatebot.com)
[![Mergify Status](https://img.shields.io/endpoint.svg?url=https://gh.mergify.io/badges/NordicSemiconductor/cloud-aws-cloudformation-cleaner-js)](https://mergify.io)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
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

    git clone https://github.com/NordicSemiconductor/cloud-aws-cloudformation-cleaner-js
    npm ci
    npx tsc

## Setup in your CI account

> Note: you should only set this up in an account where every CloudFormation
> stack can be deleted, because this lambda has the permissions to delete
> everything.

    npx cdk deploy

### Configuration

You can configure the regular expression used to check against a stack or log
group name with the environment variable `STACK_NAME_REGEX` of the
`stack-cleaner` lambda, e.g. `^asset-tracker-`. For the `log-group-cleaner`
lambda, the environment variable is called `LOG_GROUP_NAME_REGEX`. For the
`role-cleaner` lambda, the environment variable is called `ROLE_NAME_REGEX`. For
the `s3-cleaner` lambda, the environment variable is called `BUCKET_NAME_REGEX`.

You can optionally configure the environment variable `AGE_IN_HOURS` to set the
minimum age in hours after which a resource is deleted. The default is `24`.

The `LOGFILE_LIMIT` environment variable configures the number of log groups to
delete in one run. The default is `100`.
