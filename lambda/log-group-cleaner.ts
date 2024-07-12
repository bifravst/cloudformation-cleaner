import {
	CloudWatchLogsClient,
	DeleteLogGroupCommand,
	DescribeLogGroupsCommand,
} from '@aws-sdk/client-cloudwatch-logs'
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'
import { fromEnv } from '@bifravst/from-env'

// TODO: make SSM parameter
const ageInHours = 24

const logs = new CloudWatchLogsClient({})
const ssm = new SSMClient({})

const { logGroupNameRegExpParamName } = fromEnv({
	logGroupNameRegExpParamName: 'LOG_GROUP_NAME_REGEX_PARAMETER_NAME',
})(process.env)

const logGroupNamePatternPromise = (async () => {
	const res = await ssm.send(
		new GetParameterCommand({
			Name: logGroupNameRegExpParamName,
		}),
	)

	return res.Parameter?.Value ?? '^asset-tracker-'
})()

/**
 * find log groups to delete
 */
const findLogGroupsToDelete = async (
	limit = 100,
	logGroupsToDelete?: {
		pattern: string
		resources: string[]
	},
	startToken?: string,
): Promise<{
	pattern: string
	resources: string[]
}> => {
	const logGroupNamePattern = await logGroupNamePatternPromise
	if (logGroupsToDelete === undefined)
		logGroupsToDelete = {
			pattern: logGroupNamePattern,
			resources: [],
		}
	if (logGroupsToDelete.resources.length >= limit) return logGroupsToDelete
	const { logGroups, nextToken } = await logs.send(
		new DescribeLogGroupsCommand({
			limit: 50,
			nextToken: startToken,
		}),
	)

	const logGroupNameRegExp = new RegExp(logGroupNamePattern)

	if (logGroups !== undefined) {
		const foundLogGroupsToDelete: string[] = logGroups
			.filter(({ logGroupName }) => logGroupNameRegExp.test(logGroupName ?? ''))
			.filter(
				({ creationTime }) =>
					Date.now() - (creationTime ?? Date.now()) >
					ageInHours * 60 * 60 * 1000,
			)
			.map(({ logGroupName }) => logGroupName as string)

		//  log groups
		const ignoredLogGroups = logGroups
			?.filter(
				({ logGroupName }) =>
					!foundLogGroupsToDelete.includes(logGroupName ?? ''),
			)
			.map(({ logGroupName }) => logGroupName)
		ignoredLogGroups?.forEach((name) => console.log(`Ignored: ${name}`))
		logGroupsToDelete.resources.push(...foundLogGroupsToDelete)
	}
	if (nextToken !== undefined && nextToken !== null)
		return findLogGroupsToDelete(limit, logGroupsToDelete, nextToken)
	return logGroupsToDelete
}

export const handler = async (): Promise<{
	pattern: string
	resources: string[]
}> => {
	// Find old log groups to delete
	const logGroupsToDelete = await findLogGroupsToDelete()
	await logGroupsToDelete.resources.reduce(
		async (promise, logGroupName) =>
			promise.then(async () => {
				const waitPromise = new Promise((resolve) => setTimeout(resolve, 500))
				try {
					console.log(`Deleting log group: ${logGroupName}`)
					await logs.send(
						new DeleteLogGroupCommand({
							logGroupName,
						}),
					)
				} catch (err) {
					console.debug(
						`Failed to delete log group ${logGroupName}: ${
							(err as Error).message
						}`,
					)
				}
				await waitPromise
			}),
		Promise.resolve(),
	)
	return logGroupsToDelete
}
