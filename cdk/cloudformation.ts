import { App } from './App'

const STACK_NAME = process.env.STACK_NAME ?? 'cloudformation-cleaner'
const STACK_NAME_PREFIX = process.env.STACK_NAME_PREFIX ?? 'bifravst-'

new App({
	stackName: STACK_NAME,
	stackNamePrefix: STACK_NAME_PREFIX,
}).synth()
