import * as CloudFormation from '@aws-cdk/core'
import { Stack } from './Stack'

export class App extends CloudFormation.App {
	public constructor({
		stackName,
		stackNamePrefix,
	}: {
		stackName: string
		stackNamePrefix: string
	}) {
		super()

		new Stack(this, stackName, { stackNamePrefix })
	}
}
