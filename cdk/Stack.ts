import * as CloudFormation from 'aws-cdk-lib'
import { aws_lambda as Lambda } from 'aws-cdk-lib'
import { CleanerLambda } from './CleanerLambda'

export class Stack extends CloudFormation.Stack {
	public constructor(
		parent: CloudFormation.App,
		id: string,
		{ layerZipFileLocation }: { layerZipFileLocation: string },
	) {
		super(parent, id)

		const layer = new Lambda.LayerVersion(this, 'layer', {
			compatibleRuntimes: [Lambda.Runtime.NODEJS_12_X],
			code: Lambda.Code.fromAsset(layerZipFileLocation),
		})

		const stackCleanerLambda = new CleanerLambda(
			this,
			'stackCleanerLambda',
			'stack-cleaner',
			[layer],
		)

		new CloudFormation.CfnOutput(this, 'stackCleanerLambdaName', {
			value: stackCleanerLambda.lambda.functionName,
			exportName: `${this.stackName}:stackCleanerLambdaName`,
		})

		const logGroupsCleanerLambda = new CleanerLambda(
			this,
			'logGroupCleanerLambda',
			'log-group-cleaner',
			[layer],
		)

		new CloudFormation.CfnOutput(this, 'logGroupsCleanerLambdaName', {
			value: logGroupsCleanerLambda.lambda.functionName,
			exportName: `${this.stackName}:logGroupsCleanerLambdaName`,
		})

		const roleCleanerLambda = new CleanerLambda(
			this,
			'roleCleanerLambda',
			'role-cleaner',
			[layer],
		)

		new CloudFormation.CfnOutput(this, 'roleCleanerLambdaName', {
			value: roleCleanerLambda.lambda.functionName,
			exportName: `${this.stackName}:roleCleanerLambdaName`,
		})

		const s3CleanerLambda = new CleanerLambda(
			this,
			's3CleanerLambda',
			's3-cleaner',
			[layer],
		)

		new CloudFormation.CfnOutput(this, 's3CleanerLambdaName', {
			value: s3CleanerLambda.lambda.functionName,
			exportName: `${this.stackName}:s3CleanerLambdaName`,
		})
	}
}
