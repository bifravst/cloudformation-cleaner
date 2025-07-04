import type { PackedLayer } from '@bifravst/aws-cdk-lambda-helpers/layer'
import * as CloudFormation from 'aws-cdk-lib'
import { aws_ssm as SSM } from 'aws-cdk-lib'
import { CleanerLambda } from './CleanerLambda.ts'
import { BaseLayerVersion } from './resources/BaseLayerVersion.ts'
import type { CleanerLambdas } from './resources/lambdas.ts'

export class Stack extends CloudFormation.Stack {
	public constructor(
		parent: CloudFormation.App,
		id: string,
		{
			baseLayerSource,
			lambdaSources,
		}: { lambdaSources: CleanerLambdas; baseLayerSource: PackedLayer },
	) {
		super(parent, id)

		const layer = new BaseLayerVersion(this, baseLayerSource)

		const stackNameRegExParamName = `/${id}/stackNameRegEx`
		new SSM.StringParameter(this, 'stackNameRegExParam', {
			stringValue: 'asset-tracker-',
			parameterName: stackNameRegExParamName,
		})

		const stackCleaner = new CleanerLambda(
			this,
			'stackCleanerLambda',
			lambdaSources.stackCleaner,
			[layer.layerVersion],
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
			lambdaSources.logGroupCleaner,
			[layer.layerVersion],
			{
				LOG_GROUP_NAME_REGEX_PARAMETER_NAME: logGroupNameRegExParamName,
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
			lambdaSources.roleCleaner,
			[layer.layerVersion],
			{
				ROLE_NAME_REGEX_PARAMETER_NAME: roleNameRegExParamName,
			},
		)

		const parameterNameRegExpParamName = `/${id}/parameterNameRegEx`
		new SSM.StringParameter(this, 'parameterNameRegExpParam', {
			stringValue: 'asset-tracker-',
			parameterName: parameterNameRegExpParamName,
		})

		const parameterCleaner = new CleanerLambda(
			this,
			'parameterCleanerLambda',
			lambdaSources.parameterCleaner,
			[layer.layerVersion],
			{
				PARAMETER_NAME_REGEX_PARAMETER_NAME: parameterNameRegExpParamName,
			},
		)

		const bucketNameRegExpParamName = `/${id}/bucketNameRegEx`
		new SSM.StringParameter(this, 'bucketNameRegExpParam', {
			stringValue: 'asset-tracker-',
			parameterName: bucketNameRegExpParamName,
		})

		const bucketCleaner = new CleanerLambda(
			this,
			'bucketCleanerLambda',
			lambdaSources.bucketCleaner,
			[layer.layerVersion],
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
