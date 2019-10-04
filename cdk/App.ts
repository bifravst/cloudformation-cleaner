import * as CloudFormation from '@aws-cdk/core'
import { Stack } from './Stack'

export class App extends CloudFormation.App {
	public constructor({
		stackId,
		stackNamePrefix,
	}: {
		stackId: string
		stackNamePrefix: string
	}) {
		super()

		new Stack(this, stackId, { stackNamePrefix })
	}
}
