import {
	aws_events as Events,
	aws_events_targets as EventsTargets,
	aws_iam as IAM,
	aws_lambda as Lambda,
	aws_logs as CloudWatchLogs,
	Duration,
	RemovalPolicy,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as fs from 'fs'
import * as path from 'path'

export class CleanerLambda extends Construct {
	public readonly lambda: Lambda.IFunction
	public constructor(
		parent: Construct,
		id: string,
		source: 'stack-cleaner' | 'log-group-cleaner',
		layers: Lambda.ILayerVersion[],
	) {
		super(parent, id)

		this.lambda = new Lambda.Function(this, 'lambda', {
			code: Lambda.Code.fromInline(
				fs.readFileSync(
					path.join(process.cwd(), 'dist', 'lambda', `${source}.js`),
					'utf-8',
				),
			),
			description: `Cleans old CloudFormation resources (${source})`,
			handler: 'index.handler',
			runtime: Lambda.Runtime.NODEJS_12_X, // NODEJS_14_X does not support inline functions, yet. See https://github.com/aws/aws-cdk/pull/12861#discussion_r570038002,
			timeout: Duration.seconds(60),
			initialPolicy: [
				new IAM.PolicyStatement({
					resources: ['*'],
					actions: ['*'],
				}),
			],
			layers,
		})

		new CloudWatchLogs.LogGroup(this, 'LogGroup', {
			removalPolicy: RemovalPolicy.DESTROY,
			logGroupName: `/aws/lambda/${this.lambda.functionName}`,
			retention: CloudWatchLogs.RetentionDays.ONE_WEEK,
		})

		const rule = new Events.Rule(this, 'invokeMessageCounterRule', {
			schedule: Events.Schedule.expression('rate(1 hour)'),
			description:
				'Invoke the lambda which cleans up old CloudFormation resources',
			enabled: true,
			targets: [new EventsTargets.LambdaFunction(this.lambda)],
		})

		this.lambda.addPermission('InvokeByEvents', {
			principal: new IAM.ServicePrincipal('events.amazonaws.com'),
			sourceArn: rule.ruleArn,
		})
	}
}
