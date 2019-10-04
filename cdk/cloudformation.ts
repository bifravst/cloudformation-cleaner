import { App } from './App'

const STACK_ID = process.env.STACK_ID || 'cloudformation-cleaner'
const STACK_NAME_PREFIX = process.env.STACK_NAME_PREFIX || 'bifravst-'

new App({
	stackId: STACK_ID,
	stackNamePrefix: STACK_NAME_PREFIX,
}).synth()
