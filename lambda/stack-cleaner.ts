import {
	CloudFormationClient,
	DeleteStackCommand,
	DescribeStackResourcesCommand,
	ListStacksCommand,
} from '@aws-sdk/client-cloudformation'
import { S3Client } from '@aws-sdk/client-s3'
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { deleteS3Bucket } from './deleteS3Bucket.js'

// TODO: make SSM parameter
const ageInHours = 24

const cf = new CloudFormationClient({})
const s3 = new S3Client({})
const ssm = new SSMClient({})

const { stackNameRegexpParamName } = fromEnv({
	stackNameRegexpParamName: 'STACK_NAME_REGEX_PARAMETER_NAME',
})(process.env)

const stackNameRegexpPromise = (async () => {
	const res = await ssm.send(
		new GetParameterCommand({
			Name: stackNameRegexpParamName,
		}),
	)

	return new RegExp(res.Parameter?.Value ?? /^asset-tracker-/)
})()

/**
 * find stacks to delete
 */
const findStacksToDelete = async (
	limit = 100,
	stacksToDelete: string[] = [],
): Promise<string[]> => {
	if (stacksToDelete.length >= limit) return stacksToDelete
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

	const stackNameRegexp = await stackNameRegexpPromise

	if (StackSummaries !== undefined) {
		const foundStacksToDelete: string[] = StackSummaries.filter(
			({ StackName }) => stackNameRegexp.test(StackName ?? ''),
		)
			.filter(
				({ CreationTime }) =>
					Date.now() - (CreationTime?.getTime() ?? Date.now()) >
					ageInHours * 60 * 60 * 100,
			)
			.map(({ StackName }) => StackName as string)

		//  log groups
		const ignoredStacks = StackSummaries?.filter(
			({ StackName }) => !foundStacksToDelete.includes(StackName ?? ''),
		).map(({ StackName }) => StackName)
		ignoredStacks?.forEach((name) => console.log(`Ignored: ${name}`))
		stacksToDelete.push(...foundStacksToDelete)
	}
	return stacksToDelete
}

export const handler = async (): Promise<void> => {
	const stacksToDelete = await findStacksToDelete()

	// Shuffle the array, this helps to delete stacks which have dependencies to other stacks.
	// Eventually all stacks will be deleted in the right order
	for (let i = stacksToDelete.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		;[stacksToDelete[i], stacksToDelete[j]] = [
			stacksToDelete[j],
			stacksToDelete[i],
		]
	}

	// Delete at most 10 stacks at once (again to compensate for dependencies)
	return stacksToDelete.slice(0, 10).reduce(
		async (promise, StackName) =>
			promise.then(async () => {
				// Delete S3 Buckets of the stack
				const resources = await cf.send(
					new DescribeStackResourcesCommand({ StackName }),
				)
				const s3buckets = resources?.StackResources?.filter(
					(res) => res.ResourceType === 'AWS::S3::Bucket',
				)
					.map(({ PhysicalResourceId }) => PhysicalResourceId as string)
					.filter((PhysicalResourceId) => PhysicalResourceId !== undefined)
				await Promise.all(s3buckets?.map(deleteS3Bucket(s3)) ?? [])

				// Delete the Stack itself
				console.log(`Deleting: ${StackName}`)
				await cf.send(new DeleteStackCommand({ StackName }))
			}),
		Promise.resolve(),
	)
}
