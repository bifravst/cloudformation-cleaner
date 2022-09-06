import {
	DeleteRoleCommand,
	DetachRolePolicyCommand,
	IAMClient,
	ListAttachedRolePoliciesCommand,
	ListRolesCommand,
} from '@aws-sdk/client-iam'

const AGE_IN_HOURS = parseInt(process.env.AGE_IN_HOURS ?? '24', 10)

const ROLE_NAME_REGEX =
	process.env.ROLE_NAME_REGEX !== undefined
		? new RegExp(process.env.ROLE_NAME_REGEX)
		: /^asset-tracker-/

const iam = new IAMClient({})

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
	if (Roles !== undefined) {
		const foundRolesToDelete: string[] = Roles.filter(({ RoleName }) =>
			ROLE_NAME_REGEX.test(RoleName ?? ''),
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
