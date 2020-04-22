import { CloudFormation } from 'aws-sdk'

const cf = new CloudFormation()

const STACK_NAME_PREFIX = process.env?.STACK_NAME_PREFIX ?? 'bifravst-'

export const handler = async () => {
	const { StackSummaries } = await cf
		.listStacks({
			StackStatusFilter: [
				'CREATE_FAILED',
				'CREATE_COMPLETE',
				'ROLLBACK_FAILED',
				'ROLLBACK_COMPLETE',
				'DELETE_FAILED',
			],
		})
		.promise()

	// Find stacks that match the given regex in the event and that are older than 24 hours
	const stacksToDelete =
		StackSummaries?.filter(({ StackName }) =>
			StackName.startsWith(STACK_NAME_PREFIX),
		)
			.filter(
				({ CreationTime }) =>
					Date.now() - CreationTime.getTime() > 24 * 60 * 60 * 1000,
			)
			.map(({ StackName }) => StackName) ?? []

	// Log ignored stacks
	const ignoredStacks = StackSummaries?.filter(
		({ StackName }) => !stacksToDelete.includes(StackName),
	).map(({ StackName }) => StackName)
	console.log(JSON.stringify({ ignoredStacks }))

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
				console.log(StackName)
				await cf.deleteStack({ StackName }).promise()
			}),
		Promise.resolve(),
	)
}
