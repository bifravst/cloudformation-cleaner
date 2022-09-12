import {
	CloudFormationClient,
	DeleteStackCommand,
	DescribeStackResourcesCommand,
	ListStacksCommand,
} from '@aws-sdk/client-cloudformation'
import { S3Client } from '@aws-sdk/client-s3'
import { deleteS3Bucket } from './deleteS3Bucket'

const cf = new CloudFormationClient({})
const s3 = new S3Client({})

const AGE_IN_HOURS = parseInt(process.env.AGE_IN_HOURS ?? '24', 10)

const STACK_NAME_REGEX =
	process.env.STACK_NAME_REGEX !== undefined
		? new RegExp(process.env.STACK_NAME_REGEX)
		: /^asset-tracker-/

export const handler = async (): Promise<void> => {
	// Find stacks in state to be deleted
	const { StackSummaries } = await cf.send(
		new ListStacksCommand({
			StackStatusFilter: [
				'CREATE_FAILED',
				'CREATE_COMPLETE',
				'ROLLBACK_FAILED',
				'ROLLBACK_COMPLETE',
				'DELETE_FAILED',
			],
		}),
	)

	// Find stacks that match the given regex in the event and that are older than 24 hours
	const stacksToDelete =
		StackSummaries?.filter(({ StackName }) =>
			STACK_NAME_REGEX.test(StackName ?? ''),
		)
			.filter(
				({ CreationTime }) =>
					Date.now() - (CreationTime?.getTime() ?? Date.now()) >
					AGE_IN_HOURS * 60 * 60 * 100,
			)
			.map(({ StackName }) => StackName) ?? []

	// Log ignored stacks
	const ignoredStacks = StackSummaries?.filter(
		({ StackName }) => !stacksToDelete.includes(StackName),
	).map(({ StackName }) => StackName)
	ignoredStacks?.forEach((name) => console.log(`Ignored: ${name}`))

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
				).map(({ PhysicalResourceId }) => PhysicalResourceId as string)
				await Promise.all(s3buckets?.map(deleteS3Bucket(s3)) ?? [])

				// Delete the Stack itself
				console.log(`Deleting: ${StackName}`)
				await cf.send(new DeleteStackCommand({ StackName }))
			}),
		Promise.resolve(),
	)
}
