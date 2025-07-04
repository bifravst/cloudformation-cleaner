import { App } from './App.ts'
import { pack } from './resources/baseLayer.ts'
import { packLambdas } from './resources/lambdas.ts'
import { STACK_NAME } from './STACK_NAME.ts'

new App({
	stackName: STACK_NAME,
	baseLayerSource: await pack(),
	lambdaSources: await packLambdas(),
})
