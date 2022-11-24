import {
	DeleteRoleCommand,
	DetachRolePolicyCommand,
	IAMClient,
	ListAttachedRolePoliciesCommand,
	ListRolesCommand,
} from '@aws-sdk/client-iam'
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'
import { fromEnv } from '@nordicsemiconductor/from-env'

const AGE_IN_HOURS = parseInt(process.env.AGE_IN_HOURS ?? '24', 10)

const iam = new IAMClient({})
const ssm = new SSMClient({})

const { roleNameNameRegExpParamName } = fromEnv({
	roleNameNameRegExpParamName: 'ROLE_NAME_REGEX_PARAMETER_NAME',
})(process.env)

const roleNameNameRegExpPromise = (async () => {
	const res = await ssm.send(
		new GetParameterCommand({
			Name: roleNameNameRegExpParamName,
		}),
	)

	return new RegExp(res.Parameter?.Value ?? /^asset-tracker-/)
})()

/**
 * Recursively find roles to delete
 */
const findRolesToDelete = async (
	limit = 100,
	rolesToDelete: string[] = [],
	startToken?: string,
): Promise<string[]> => {
	if (rolesToDelete.length >= limit) return rolesToDelete
	const { Roles, Marker } = await iam.send(
		new ListRolesCommand({
			MaxItems: 50,
			Marker: startToken,
		}),
	)

	const roleNameRegExp = await roleNameNameRegExpPromise

	if (Roles !== undefined) {
		const foundRolesToDelete: string[] = Roles.filter(({ RoleName }) =>
			roleNameRegExp.test(RoleName ?? ''),
		)
			.filter(
				({ CreateDate }) =>
					Date.now() - (CreateDate?.getTime() ?? Date.now()) >
					AGE_IN_HOURS * 60 * 60 * 100,
			)
			.map(({ RoleName }) => RoleName as string)

		// Log ignored log groups
		const ignoredRoles = Roles?.filter(
			({ RoleName }) => !foundRolesToDelete.includes(RoleName ?? ''),
		).map(({ RoleName }) => RoleName)
		ignoredRoles?.forEach((name) => console.log(`Ignored: ${name}`))
		rolesToDelete.push(...foundRolesToDelete)
	}
	if (Marker !== undefined && Marker !== null)
		return findRolesToDelete(limit, rolesToDelete, Marker)
	return rolesToDelete
}

export const handler = async (): Promise<void> => {
	// Find old log roles to delete
	const rolesToDelete = await findRolesToDelete()
	await rolesToDelete.reduce(
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
}
