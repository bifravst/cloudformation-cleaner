import * as CloudFormation from '@aws-cdk/core'
import { Stack } from './Stack'

export class App extends CloudFormation.App {
	public constructor({
		stackName,
		layerZipFileLocation,
	}: {
		stackName: string
		layerZipFileLocation: string
	}) {
		super()

		new Stack(this, stackName, { layerZipFileLocation })
	}
}
