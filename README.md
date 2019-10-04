# AWS CloudFormation Cleaner

[![GitHub Actions](https://github.com/bifravst/cloudformation-cleaner/workflows/Test%20and%20Release/badge.svg)](https://github.com/bifravst/cloudformation-cleaner/actions)
[![Greenkeeper badge](https://badges.greenkeeper.io/bifravst/cloudformation-cleaner.svg)](https://greenkeeper.io/)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier/)
[![ESLint: TypeScript](https://img.shields.io/badge/ESLint-TypeScript-blue.svg)](https://github.com/typescript-eslint/typescript-eslint)

This is a [CDK](https://github.com/aws/aws-cdk) project written in TypeScript
that sets up a CloudFormation stack which cleans up left-over stacks from CI
runs.

Although your CI tests _should_ clean up after themselves, there still might be
stacks that get not cleaned up perfectly. This stack runs a lambda every hour,
which deletes stacks that have a certain prefix and are older than 24 hours.

## Install

    git clone https://github.com/bifravst/cloudformation-cleaner
    npm ci

## Setup in your CI account

> Note: you should only set this up in an account where every CloudFormation
> stack can be deleted, because this lambda has the permissions to delete
> everything.

    # you can configure the prefix with this environment variable:
    export STACK_PREFIX=your-ci-stack-prefix-
    npx cdk deploy
