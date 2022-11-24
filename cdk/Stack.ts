import * as CloudFormation from 'aws-cdk-lib'
import { aws_lambda as Lambda, aws_ssm as SSM } from 'aws-cdk-lib'
import { CleanerLambda } from './CleanerLambda'

export class Stack extends CloudFormation.Stack {
	public constructor(
		parent: CloudFormation.App,
		id: string,
		{ layerZipFileLocation }: { layerZipFileLocation: string },
	) {
		super(parent, id)

		const layer = new Lambda.LayerVersion(this, 'layer', {
			compatibleRuntimes: [Lambda.Runtime.NODEJS_18_X],
			code: Lambda.Code.fromAsset(layerZipFileLocation),
		})

		const stackNameRegExParamName = `/${id}/stackNameRegEx`
		new SSM.StringParameter(this, 'stackNameRegExParam', {
			stringValue: 'asset-tracker-',
			parameterName: stackNameRegExParamName,
		})

		const stackCleanerLambda = new CleanerLambda(
			this,
			'stackCleanerLambda',
			'stack-cleaner',
			[layer],
			{
				STACK_NAME_REGEX_PARAMETER_NAME: stackNameRegExParamName,
			},
		)

		new CloudFormation.CfnOutput(this, 'stackCleanerLambdaName', {
			value: stackCleanerLambda.lambda.functionName,
			exportName: `${this.stackName}:stackCleanerLambdaName`,
		})

		const logGroupNameRegExParamName = `/${id}/logGroupNameRegEx`
		new SSM.StringParameter(this, 'logGroupNameRegExParam', {
			stringValue: 'asset-tracker-',
			parameterName: logGroupNameRegExParamName,
		})

		const logGroupsCleanerLambda = new CleanerLambda(
			this,
			'logGroupCleanerLambda',
			'log-group-cleaner',
			[layer],
			{
				LOG_GROUP_NAME_REGEX_PARAMETER_NAME: stackNameRegExParamName,
			},
		)

		new CloudFormation.CfnOutput(this, 'logGroupsCleanerLambdaName', {
			value: logGroupsCleanerLambda.lambda.functionName,
			exportName: `${this.stackName}:logGroupsCleanerLambdaName`,
		})

		const roleNameRegExParamName = `/${id}/roleNameRegEx`
		new SSM.StringParameter(this, 'roleNameRegExParam', {
			stringValue: 'asset-tracker-',
			parameterName: roleNameRegExParamName,
		})

		const roleCleanerLambda = new CleanerLambda(
			this,
			'roleCleanerLambda',
			'role-cleaner',
			[layer],
			{
				ROLE_NAME_REGEX_PARAMETER_NAME: roleNameRegExParamName,
			},
		)

		new CloudFormation.CfnOutput(this, 'roleCleanerLambdaName', {
			value: roleCleanerLambda.lambda.functionName,
			exportName: `${this.stackName}:roleCleanerLambdaName`,
		})

		const parameterNameRegExpParamName = `/${id}/parameterNameRegExp`
		new SSM.StringParameter(this, 'parameterNameRegExpParam', {
			stringValue: 'asset-tracker-',
			parameterName: parameterNameRegExpParamName,
		})

		const parameterCleanerLambda = new CleanerLambda(
			this,
			'parameterCleanerLambda',
			'parameter-cleaner',
			[layer],
			{
				PARAMETER_NAME_REGEX_PARAMETER_NAME: parameterNameRegExpParamName,
			},
		)

		new CloudFormation.CfnOutput(this, 'parameterCleanerLambdaName', {
			value: parameterCleanerLambda.lambda.functionName,
			exportName: `${this.stackName}:parameterCleanerLambdaName`,
		})
	}
}
