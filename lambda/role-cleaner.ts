import {
	DeleteRoleCommand,
	DetachRolePolicyCommand,
	IAMClient,
	ListAttachedRolePoliciesCommand,
	ListRolesCommand,
} from '@aws-sdk/client-iam'
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'
import { fromEnv } from '@bifravst/from-env'

// TODO: make SSM parameter
const ageInHours = 24

const iam = new IAMClient({})
const ssm = new SSMClient({})

const { roleNameNameRegExpParamName } = fromEnv({
	roleNameNameRegExpParamName: 'ROLE_NAME_REGEX_PARAMETER_NAME',
})(process.env)

const roleNameNamePatternPromise = (async () => {
	const res = await ssm.send(
		new GetParameterCommand({
			Name: roleNameNameRegExpParamName,
		}),
	)

	return res.Parameter?.Value ?? '^asset-tracker-'
})()

/**
 * find roles to delete
 */
const findRolesToDelete = async (
	limit = 100,
	rolesToDelete?: {
		resources: string[]
		pattern: string
	},
	startToken?: string,
): Promise<{
	resources: string[]
	pattern: string
}> => {
	const roleNamePattern = await roleNameNamePatternPromise
	if (rolesToDelete === undefined) {
		rolesToDelete = {
			pattern: roleNamePattern,
			resources: [],
		}
	}
	if (rolesToDelete.resources.length >= limit) return rolesToDelete
	const { Roles, Marker } = await iam.send(
		new ListRolesCommand({
			MaxItems: 50,
			Marker: startToken,
		}),
	)

	const roleNameRegExp = new RegExp(roleNamePattern)

	if (Roles !== undefined) {
		const foundRolesToDelete: string[] = Roles.filter(({ RoleName }) =>
			roleNameRegExp.test(RoleName ?? ''),
		)
			.filter(
				({ CreateDate }) =>
					Date.now() - (CreateDate?.getTime() ?? Date.now()) >
					ageInHours * 60 * 60 * 1000,
			)
			.map(({ RoleName }) => RoleName as string)

		//  log groups
		const ignoredRoles = Roles?.filter(
			({ RoleName }) => !foundRolesToDelete.includes(RoleName ?? ''),
		).map(({ RoleName }) => RoleName)
		ignoredRoles?.forEach((name) => console.log(`Ignored: ${name}`))
		rolesToDelete.resources.push(...foundRolesToDelete)
	}
	if (Marker !== undefined && Marker !== null)
		return findRolesToDelete(limit, rolesToDelete, Marker)
	return rolesToDelete
}

export const handler = async (): Promise<{
	resources: string[]
	pattern: string
}> => {
	// Find old log roles to delete
	const rolesToDelete = await findRolesToDelete()
	await rolesToDelete.resources.reduce(
		async (promise, RoleName) =>
			promise.then(async () => {
				try {
					const policies = await iam.send(
						new ListAttachedRolePoliciesCommand({ RoleName }),
					)
					for (const { PolicyArn } of policies?.AttachedPolicies ?? []) {
						console.log(RoleName, `Detaching policy`, PolicyArn)
						await iam.send(
							new DetachRolePolicyCommand({
								RoleName,
								PolicyArn,
							}),
						)
					}

					console.log(RoleName, `Deleting role.`)
					await iam.send(
						new DeleteRoleCommand({
							RoleName,
						}),
					)
				} catch (err) {
					console.debug(
						`Failed to delete role ${RoleName}: ${(err as Error).message}`,
					)
				}
			}),
		Promise.resolve(),
	)

	return rolesToDelete
}
