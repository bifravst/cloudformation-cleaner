import {
	CloudFormationClient,
	DescribeStacksCommand,
} from '@aws-sdk/client-cloudformation'
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda'
import { STACK_NAME } from './cdk/STACK_NAME.js'

const cf = new CloudFormationClient({})
const lambda = new LambdaClient({})

const { Stacks } = await cf.send(
	new DescribeStacksCommand({ StackName: STACK_NAME }),
)

const { Outputs } = Stacks?.[0] ?? {}

await Promise.all(
	(Outputs ?? []).map(
		async ({ OutputKey: name, OutputValue: FunctionName }) => {
			console.log(`[${name}]`, `Invoking`, FunctionName)
			const { StatusCode, Payload } = await lambda.send(
				new InvokeCommand({
					FunctionName,
				}),
			)
			console.log(`[${name}]`, StatusCode)
			try {
				const { pattern, resources }: { pattern: string; resources: string[] } =
					JSON.parse(new TextDecoder().decode(Payload))
				console.log(`[${name}]`, 'Pattern', pattern)
				if (resources.length === 0) {
					console.log(`[${name}]`, `No resources deleted`)
				} else {
					console.log(`[${name}]`, 'Deleted resources')
					for (const res of resources) {
						console.log(res)
					}
				}
			} catch {
				// pass
			}
		},
	),
)
