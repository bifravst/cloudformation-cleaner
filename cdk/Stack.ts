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

		const stackCleaner = new CleanerLambda(
			this,
			'stackCleanerLambda',
			'stack-cleaner',
			[layer],
			{
				STACK_NAME_REGEX_PARAMETER_NAME: stackNameRegExParamName,
			},
		)

		const logGroupNameRegExParamName = `/${id}/logGroupNameRegEx`
		new SSM.StringParameter(this, 'logGroupNameRegExParam', {
			stringValue: 'asset-tracker-',
			parameterName: logGroupNameRegExParamName,
		})

		const logGroupCleaner = new CleanerLambda(
			this,
			'logGroupCleanerLambda',
			'log-group-cleaner',
			[layer],
			{
				LOG_GROUP_NAME_REGEX_PARAMETER_NAME: stackNameRegExParamName,
			},
		)

		const roleNameRegExParamName = `/${id}/roleNameRegEx`
		new SSM.StringParameter(this, 'roleNameRegExParam', {
			stringValue: 'asset-tracker-',
			parameterName: roleNameRegExParamName,
		})

		const roleCleaner = new CleanerLambda(
			this,
			'roleCleanerLambda',
			'role-cleaner',
			[layer],
			{
				ROLE_NAME_REGEX_PARAMETER_NAME: roleNameRegExParamName,
			},
		)

		const parameterNameRegExpParamName = `/${id}/parameterNameRegExp`
		new SSM.StringParameter(this, 'parameterNameRegExpParam', {
			stringValue: 'asset-tracker-',
			parameterName: parameterNameRegExpParamName,
		})

		const parameterCleaner = new CleanerLambda(
			this,
			'parameterCleanerLambda',
			'parameter-cleaner',
			[layer],
			{
				PARAMETER_NAME_REGEX_PARAMETER_NAME: parameterNameRegExpParamName,
			},
		)

		const bucketNameRegExpParamName = `/${id}/bucketNameRegExp`
		new SSM.StringParameter(this, 'bucketNameRegExpParam', {
			stringValue: 'asset-tracker-',
			parameterName: bucketNameRegExpParamName,
		})

		const bucketCleaner = new CleanerLambda(
			this,
			'bucketCleanerLambda',
			'bucket-cleaner',
			[layer],
			{
				BUCKET_NAME_REGEX_PARAMETER_NAME: bucketNameRegExpParamName,
			},
		)

		new CloudFormation.CfnOutput(this, 'stackCleaner', {
			value: stackCleaner.lambda.functionName,
		})

		new CloudFormation.CfnOutput(this, 'logGroupCleaner', {
			value: logGroupCleaner.lambda.functionName,
		})

		new CloudFormation.CfnOutput(this, 'roleCleaner', {
			value: roleCleaner.lambda.functionName,
		})

		new CloudFormation.CfnOutput(this, 'parameterCleaner', {
			value: parameterCleaner.lambda.functionName,
		})

		new CloudFormation.CfnOutput(this, 'bucketCleaner', {
			value: bucketCleaner.lambda.functionName,
		})
	}
}
