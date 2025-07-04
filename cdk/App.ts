import type { PackedLayer } from '@bifravst/aws-cdk-lambda-helpers/layer'
import * as CloudFormation from 'aws-cdk-lib'
import type { CleanerLambdas } from './resources/lambdas.ts'
import { Stack } from './Stack.ts'

export class App extends CloudFormation.App {
	public constructor({
		stackName,
		baseLayerSource,
		lambdaSources,
	}: {
		stackName: string
		baseLayerSource: PackedLayer
		lambdaSources: CleanerLambdas
	}) {
		super({
			context: {
				isTest: false,
			},
		})

		new Stack(this, stackName, { baseLayerSource, lambdaSources })
	}
}
