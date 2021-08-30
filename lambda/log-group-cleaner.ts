import {
	CloudWatchLogsClient,
	DeleteLogGroupCommand,
	DescribeLogGroupsCommand,
} from '@aws-sdk/client-cloudwatch-logs'

const logs = new CloudWatchLogsClient({})

const AGE_IN_HOURS = parseInt(process.env.AGE_IN_HOURS ?? '24', 10)

const LOG_GROUP_NAME_REGEX =
	process.env.LOG_GROUP_NAME_REGEX !== undefined
		? new RegExp(process.env.LOG_GROUP_NAME_REGEX)
		: /asset-tracker-/

const LOGFILE_LIMIT = parseInt(process.env.LOGFILE_LIMIT ?? '100', 10)

/**
 * Recursively find log groups to delete
 */
const findLogGroupsToDelete = async (
	limit = 100,
	logGroupsToDelete: string[] = [],
	startToken?: string,
): Promise<string[]> => {
	if (logGroupsToDelete.length >= limit) return logGroupsToDelete
	const { logGroups, nextToken } = await logs.send(
		new DescribeLogGroupsCommand({
			limit: 50,
			nextToken: startToken,
		}),
	)
	if (logGroups !== undefined) {
		const foundLogGroupsToDelete: string[] = logGroups
			.filter(({ logGroupName }) =>
				LOG_GROUP_NAME_REGEX.test(logGroupName ?? ''),
			)
			.filter(
				({ creationTime }) =>
					Date.now() - (creationTime ?? Date.now()) >
					AGE_IN_HOURS * 60 * 60 * 100,
			)
			.map(({ logGroupName }) => logGroupName as string)

		// Log ignored log groups
		const ignoredLogGroups = logGroups
			?.filter(
				({ logGroupName }) =>
					!foundLogGroupsToDelete.includes(logGroupName ?? ''),
			)
			.map(({ logGroupName }) => logGroupName)
		ignoredLogGroups?.forEach((name) => console.log(`Ignored: ${name}`))
		logGroupsToDelete.push(...foundLogGroupsToDelete)
	}
	if (nextToken !== undefined && nextToken !== null)
		return findLogGroupsToDelete(limit, logGroupsToDelete, nextToken)
	return logGroupsToDelete
}

export const handler = async (): Promise<void> => {
	// Find old log groups to delete
	const logGroupsToDelete = await findLogGroupsToDelete(LOGFILE_LIMIT)
	await logGroupsToDelete.reduce(
		async (promise, logGroupName) =>
			promise.then(async () => {
				try {
					console.log(`Deleting log group: ${logGroupName}`)
					await logs.send(
						new DeleteLogGroupCommand({
							logGroupName: logGroupName,
						}),
					)
				} catch (err) {
					console.debug(
						`Failed to delete log group ${logGroupName}: ${
							(err as Error).message
						}`,
					)
				}
			}),
		Promise.resolve(),
	)
}
