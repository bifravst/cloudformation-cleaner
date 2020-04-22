import { CloudFormation, S3 } from 'aws-sdk'

const cf = new CloudFormation()
const s3 = new S3()

const STACK_NAME_REGEX = process.env.STACK_NAME_REGEX
	? new RegExp(process.env.STACK_NAME_REGEX)
	: /^bifravst-/

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
		StackSummaries?.filter(({ StackName }) => STACK_NAME_REGEX.test(StackName))
			.filter(
				({ CreationTime }) =>
					Date.now() - CreationTime.getTime() > 24 * 60 * 60 * 1000,
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
				const resources = await cf
					.describeStackResources({ StackName })
					.promise()
				const s3buckets = resources?.StackResources?.filter(
					(res) => res.ResourceType === 'AWS::S3::Bucket',
				).map(({ PhysicalResourceId }) => PhysicalResourceId as string)
				await Promise.all(
					s3buckets?.map(async (Bucket) => {
						console.log(`Deleting S3 Bucket: ${Bucket}`)
						// Delete Items
						s3.listObjects({ Bucket })
							.promise()
							.then(async ({ Contents }) => {
								if (Contents)
									await s3
										.deleteObjects({
											Bucket,
											Delete: {
												Objects: Contents.map(({ Key }) => ({
													Key: Key as string,
												})),
											},
										})
										.promise()
								// Delete Bucket
								return s3.deleteBucket({ Bucket }).promise()
							})
							.catch((err) => {
								console.debug(
									`Failed to delete bucket ${Bucket}: ${err.message}`,
								)
							})
					}) ?? [],
				)

				// Delete the Stack itself
				console.log(`Deleting: ${StackName}`)
				await cf.deleteStack({ StackName }).promise()
			}),
		Promise.resolve(),
	)
}
