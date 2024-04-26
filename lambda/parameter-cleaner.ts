import {
	DeleteParametersCommand,
	GetParameterCommand,
	GetParametersByPathCommand,
	SSMClient,
} from '@aws-sdk/client-ssm'
import { fromEnv } from '@nordicsemiconductor/from-env'

// TODO: make SSM parameter
const ageInHours = 24

const ssm = new SSMClient({})

const { parameterNameRegexpParamName } = fromEnv({
	parameterNameRegexpParamName: 'PARAMETER_NAME_REGEX_PARAMETER_NAME',
})(process.env)

const parameterNamePatternPromise = (async () => {
	const res = await ssm.send(
		new GetParameterCommand({
			Name: parameterNameRegexpParamName,
		}),
	)

	return res.Parameter?.Value ?? `^asset-tracker-`
})()

/**
 * find parameters to delete
 */
const findParametersToDelete = async (
	limit = 1000,
	parametersToDelete?: {
		pattern: string
		resources: string[]
	},
	startToken?: string,
): Promise<{
	pattern: string
	resources: string[]
}> => {
	const parameterNamePattern = await parameterNamePatternPromise
	if (parametersToDelete === undefined)
		parametersToDelete = {
			pattern: parameterNamePattern,
			resources: [],
		}
	if (parametersToDelete.resources.length >= limit) return parametersToDelete
	const { Parameters, NextToken } = await ssm.send(
		new GetParametersByPathCommand({
			Path: '/',
			NextToken: startToken,
			Recursive: true,
		}),
	)

	const parameterNameRegexp = new RegExp(parameterNamePattern)

	if (Parameters !== undefined) {
		const foundParametersToDelete: string[] = Parameters.filter(({ Name }) =>
			parameterNameRegexp.test(Name ?? ''),
		)
			.filter(
				({ LastModifiedDate }) =>
					Date.now() - (LastModifiedDate?.getTime() ?? Date.now()) >
					ageInHours * 60 * 60 * 1000,
			)
			.map(({ Name }) => Name as string)

		//  log groups
		const ignoredParameters = Parameters?.filter(
			({ Name }) => !foundParametersToDelete.includes(Name ?? ''),
		).map(({ Name }) => Name)
		ignoredParameters?.forEach((name) => console.log(`Ignored: ${name}`))
		parametersToDelete.resources.push(...foundParametersToDelete)
	}
	if (NextToken !== undefined && NextToken !== null) {
		return findParametersToDelete(limit, parametersToDelete, NextToken)
	}
	return parametersToDelete
}

export const handler = async (): Promise<{
	pattern: string
	resources: string[]
}> => {
	const parametersToDelete = await findParametersToDelete()

	const chunkSize = 10
	for (let i = 0; i < parametersToDelete.resources.length; i += chunkSize) {
		const waitPromise = new Promise((resolve) => setTimeout(resolve, 500))
		const chunk = parametersToDelete.resources.slice(i, i + chunkSize)
		console.log(`Deleting: ${chunk.join(',')}`)
		await ssm.send(
			new DeleteParametersCommand({
				Names: chunk,
			}),
		)
		await waitPromise
	}

	return parametersToDelete
}
