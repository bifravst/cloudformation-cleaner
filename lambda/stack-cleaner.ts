import {
	CloudFormationClient,
	DeleteStackCommand,
	ListStacksCommand,
} from '@aws-sdk/client-cloudformation'
import { S3Client } from '@aws-sdk/client-s3'
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { deleteS3Bucket } from './deleteS3Bucket.js'
import { listStackResources } from '@nordicsemiconductor/cloudformation-helpers'

// TODO: make SSM parameter
const ageInHours = 24

const cf = new CloudFormationClient({})
const s3 = new S3Client({})
const ssm = new SSMClient({})

const { stackNameRegexpParamName } = fromEnv({
	stackNameRegexpParamName: 'STACK_NAME_REGEX_PARAMETER_NAME',
})(process.env)

const stackNamePatternPromise = (async () => {
	const res = await ssm.send(
		new GetParameterCommand({
			Name: stackNameRegexpParamName,
		}),
	)
	return res.Parameter?.Value ?? '^asset-tracker-'
})()

/**
 * find stacks to delete
 */
const findStacksToDelete = async (
	limit = 100,
	stacksToDelete?: {
		pattern: string
		resources: string[]
	},
): Promise<{
	pattern: string
	resources: string[]
}> => {
	const stackNamePattern = await stackNamePatternPromise
	if (stacksToDelete === undefined) {
		stacksToDelete = {
			pattern: stackNamePattern,
			resources: [],
		}
	}
	if (stacksToDelete.resources.length >= limit) return stacksToDelete
	const { StackSummaries } = await cf.send(
		new ListStacksCommand({
			StackStatusFilter: [
				'CREATE_FAILED',
				'CREATE_COMPLETE',
				'ROLLBACK_FAILED',
				'ROLLBACK_COMPLETE',
				'DELETE_FAILED',
				'REVIEW_IN_PROGRESS',
			],
		}),
	)

	const stackNameRegexp = new RegExp(stackNamePattern)

	if (StackSummaries !== undefined) {
		const foundStacksToDelete: string[] = StackSummaries.filter(
			({ StackName }) => stackNameRegexp.test(StackName ?? ''),
		)
			.filter(
				({ CreationTime }) =>
					Date.now() - (CreationTime?.getTime() ?? Date.now()) >
					ageInHours * 60 * 60 * 1000,
			)
			.map(({ StackName }) => StackName as string)

		const ignoredStacks = StackSummaries?.filter(
			({ StackName }) => !foundStacksToDelete.includes(StackName ?? ''),
		).map(({ StackName }) => StackName)
		ignoredStacks?.forEach((name) => console.log(`Ignored: ${name}`))
		stacksToDelete.resources.push(...foundStacksToDelete)
	}
	return stacksToDelete
}

export const handler = async (): Promise<{
	pattern: string
	resources: string[]
}> => {
	const stacksToDelete = await findStacksToDelete()

	// Shuffle the array, this helps to delete stacks which have dependencies to other stacks.
	// Eventually all stacks will be deleted in the right order
	for (let i = stacksToDelete.resources.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		;[stacksToDelete.resources[i], stacksToDelete.resources[j]] = [
			stacksToDelete.resources[j],
			stacksToDelete.resources[i],
		]
	}

	// Delete at most 10 stacks at once (again to compensate for dependencies)
	await stacksToDelete.resources.slice(0, 10).reduce(
		async (promise, StackName) =>
			promise.then(async () => {
				// Delete S3 Buckets of the stack
				const s3buckets = await listStackResources(
					cf,
					StackName,
					'AWS::S3::Bucket',
				)

				await Promise.all(
					s3buckets.map(async ({ PhysicalResourceId }) =>
						deleteS3Bucket(s3)(PhysicalResourceId),
					),
				)

				// Delete the Stack itself
				console.log(`Deleting: ${StackName}`)
				await cf.send(new DeleteStackCommand({ StackName }))
			}),
		Promise.resolve(),
	)

	return stacksToDelete
}
