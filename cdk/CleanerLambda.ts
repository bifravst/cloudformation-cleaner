import type { PackedLambda } from '@bifravst/aws-cdk-lambda-helpers'
import { PackedLambdaFn } from '@bifravst/aws-cdk-lambda-helpers/cdk'
import type { aws_lambda as Lambda, Stack } from 'aws-cdk-lib'
import {
	Duration,
	aws_events as Events,
	aws_events_targets as EventsTargets,
	aws_iam as IAM,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'

export class CleanerLambda extends Construct {
	public readonly lambda: Lambda.IFunction
	public constructor(
		parent: Stack,
		id: string,
		source: PackedLambda,
		layers: Lambda.ILayerVersion[],
		environment: Record<string, string>,
	) {
		super(parent, id)

		this.lambda = new PackedLambdaFn(this, 'lambda', source, {
			description: `Cleans old CloudFormation resources (${id})`,
			timeout: Duration.minutes(5),
			initialPolicy: [
				new IAM.PolicyStatement({
					resources: ['*'],
					actions: ['*'],
				}),
			],
			layers,
			environment,
		}).fn

		const rule = new Events.Rule(this, 'invokeMessageCounterRule', {
			schedule: Events.Schedule.expression('rate(1 hour)'),
			description: `Invoke the ${id} which cleans up old CloudFormation resources`,
			enabled: true,
			targets: [new EventsTargets.LambdaFunction(this.lambda)],
		})

		this.lambda.addPermission('InvokeByEvents', {
			principal: new IAM.ServicePrincipal('events.amazonaws.com'),
			sourceArn: rule.ruleArn,
		})
	}
}
