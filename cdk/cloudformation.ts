import { App } from './App'

const STACK_NAME = process.env.STACK_NAME ?? 'cloudformation-cleaner'
const STACK_NAME_PREFIX = process.env.STACK_NAME_PREFIX ?? 'asset-tracker-'

new App({
	stackName: STACK_NAME,
	stackNamePrefix: STACK_NAME_PREFIX,
}).synth()
