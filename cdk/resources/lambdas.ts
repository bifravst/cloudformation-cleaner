import {
	packLambdaFromPath,
	type PackedLambda,
} from '@bifravst/aws-cdk-lambda-helpers'

export type CleanerLambdas = {
	stackCleaner: PackedLambda
	logGroupCleaner: PackedLambda
	roleCleaner: PackedLambda
	bucketCleaner: PackedLambda
	parameterCleaner: PackedLambda
}

export const packLambdas = async (): Promise<CleanerLambdas> => ({
	stackCleaner: await packLambdaFromPath({
		id: 'stackCleaner',
		sourceFilePath: 'lambda/stack-cleaner.ts',
	}),
	logGroupCleaner: await packLambdaFromPath({
		id: 'logGroupCleaner',
		sourceFilePath: 'lambda/log-group-cleaner.ts',
	}),
	roleCleaner: await packLambdaFromPath({
		id: 'roleCleaner',
		sourceFilePath: 'lambda/role-cleaner.ts',
	}),
	bucketCleaner: await packLambdaFromPath({
		id: 'bucketCleaner',
		sourceFilePath: 'lambda/bucket-cleaner.ts',
	}),
	parameterCleaner: await packLambdaFromPath({
		id: 'parameterCleaner',
		sourceFilePath: 'lambda/parameter-cleaner.ts',
	}),
})
