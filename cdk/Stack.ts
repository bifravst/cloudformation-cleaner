import * as CloudFormation from '@aws-cdk/core'
import * as Lambda from '@aws-cdk/aws-lambda'
import * as IAM from '@aws-cdk/aws-iam'
import * as CloudWatchLogs from '@aws-cdk/aws-logs'
import * as Events from '@aws-cdk/aws-events'
import * as EventsTargets from '@aws-cdk/aws-events-targets'
import * as path from 'path'
import * as fs from 'fs'

export class Stack extends CloudFormation.Stack {
	public constructor(
		parent: CloudFormation.App,
		id: string,
		{ stackNamePrefix }: { stackNamePrefix: string },
	) {
		super(parent, id)

		const lambda = new Lambda.Function(this, 'lambda', {
			code: Lambda.Code.fromInline(
				fs.readFileSync(
					path.join(process.cwd(), 'dist', 'lambda', 'cleaner.js'),
					'utf-8',
				),
			),
			description: 'Cleans old CloudFormation stacks',
			handler: 'index.handler',
			// runtime: Lambda.Runtime.NODEJS_14_X, // FIXME: use once CDK has support
			runtime: new Lambda.Runtime('nodejs14.x', Lambda.RuntimeFamily.NODEJS, {
				supportsInlineCode: false,
			}),
			timeout: CloudFormation.Duration.seconds(60),
			initialPolicy: [
				new IAM.PolicyStatement({
					resources: ['*'],
					actions: ['*'],
				}),
			],
			environment: {
				STACK_NAME_PREFIX: stackNamePrefix,
			},
		})

		new CloudWatchLogs.LogGroup(this, 'LogGroup', {
			removalPolicy: CloudFormation.RemovalPolicy.DESTROY,
			logGroupName: `/aws/lambda/${lambda.functionName}`,
			retention: CloudWatchLogs.RetentionDays.ONE_WEEK,
		})

		const rule = new Events.Rule(this, 'invokeMessageCounterRule', {
			schedule: Events.Schedule.expression('rate(1 hour)'),
			description:
				'Invoke the lambda which cleans up old CloudFormation stacks',
			enabled: true,
			targets: [new EventsTargets.LambdaFunction(lambda)],
		})

		lambda.addPermission('InvokeByEvents', {
			principal: new IAM.ServicePrincipal('events.amazonaws.com'),
			sourceArn: rule.ruleArn,
		})

		new CloudFormation.CfnOutput(this, 'lambdaName', {
			value: lambda.functionName,
			exportName: `${this.stackName}:lambdaName`,
		})
	}
}
