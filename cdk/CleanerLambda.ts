import {
	aws_events as Events,
	aws_events_targets as EventsTargets,
	aws_iam as IAM,
	aws_lambda as Lambda,
	aws_logs as CloudWatchLogs,
	Duration,
	RemovalPolicy,
	Stack,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as path from 'path'

export class CleanerLambda extends Construct {
	public readonly lambda: Lambda.IFunction
	public constructor(
		parent: Stack,
		id: string,
		source: string,
		layers: Lambda.ILayerVersion[],
		environment: Record<string, string>,
	) {
		super(parent, id)

		this.lambda = new Lambda.Function(this, 'lambda', {
			code: Lambda.Code.fromAsset(path.join(process.cwd(), 'dist', 'lambda')),
			description: `Cleans old CloudFormation resources (${source})`,
			handler: `${source}.handler`,
			runtime: Lambda.Runtime.NODEJS_18_X,
			timeout: Duration.minutes(5),
			initialPolicy: [
				new IAM.PolicyStatement({
					resources: ['*'],
					actions: ['*'],
				}),
				new IAM.PolicyStatement({
					actions: ['ssm:GetParametersByPath', 'ssm:GetParameter'],
					resources: [
						`arn:aws:ssm:${parent.region}:${parent.account}:parameter/${parent.stackName}/*`,
					],
				}),
			],
			layers,
			environment,
		})

		new CloudWatchLogs.LogGroup(this, 'LogGroup', {
			removalPolicy: RemovalPolicy.DESTROY,
			logGroupName: `/aws/lambda/${this.lambda.functionName}`,
			retention: CloudWatchLogs.RetentionDays.ONE_WEEK,
		})

		const rule = new Events.Rule(this, 'invokeMessageCounterRule', {
			schedule: Events.Schedule.expression('rate(1 hour)'),
			description: `Invoke the ${source} which cleans up old CloudFormation resources`,
			enabled: true,
			targets: [new EventsTargets.LambdaFunction(this.lambda)],
		})

		this.lambda.addPermission('InvokeByEvents', {
			principal: new IAM.ServicePrincipal('events.amazonaws.com'),
			sourceArn: rule.ruleArn,
		})
	}
}
