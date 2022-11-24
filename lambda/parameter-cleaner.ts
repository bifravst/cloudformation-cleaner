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

const parameterNameRegexpPromise = (async () => {
	const res = await ssm.send(
		new GetParameterCommand({
			Name: parameterNameRegexpParamName,
		}),
	)

	return new RegExp(res.Parameter?.Value ?? /^asset-tracker-/)
})()

/**
 * find parameters to delete
 */
const findParametersToDelete = async (
	limit = 100,
	parametersToDelete: string[] = [],
	startToken?: string,
): Promise<string[]> => {
	if (parametersToDelete.length >= limit) return parametersToDelete
	const { Parameters, NextToken } = await ssm.send(
		new GetParametersByPathCommand({
			Path: '/',
			NextToken: startToken,
			Recursive: true,
		}),
	)

	const parameterNameRegexp = await parameterNameRegexpPromise

	if (Parameters !== undefined) {
		const foundParametersToDelete: string[] = Parameters.filter(({ Name }) =>
			parameterNameRegexp.test(Name ?? ''),
		)
			.filter(
				({ LastModifiedDate }) =>
					Date.now() - (LastModifiedDate?.getTime() ?? Date.now()) >
					ageInHours * 60 * 60 * 100,
			)
			.map(({ Name }) => Name as string)

		//  log groups
		const ignoredParameters = Parameters?.filter(
			({ Name }) => !foundParametersToDelete.includes(Name ?? ''),
		).map(({ Name }) => Name)
		ignoredParameters?.forEach((name) => console.log(`Ignored: ${name}`))
		parametersToDelete.push(...foundParametersToDelete)
	}
	if (NextToken !== undefined && NextToken !== null) {
		return findParametersToDelete(limit, parametersToDelete, NextToken)
	}
	return parametersToDelete
}

export const handler = async (): Promise<void> => {
	const parametersToDelete = await findParametersToDelete()

	const chunkSize = 10
	for (let i = 0; i < parametersToDelete.length; i += chunkSize) {
		const chunk = parametersToDelete.slice(i, i + chunkSize)
		console.log(`Deleting: ${chunk}`)
		await ssm.send(
			new DeleteParametersCommand({
				Names: chunk,
			}),
		)
	}
}
