import {
	packLayer,
	type PackedLayer,
} from '@bifravst/aws-cdk-lambda-helpers/layer'
import pJson from '../../package.json' with { type: 'json' }

const dependencies: Array<keyof (typeof pJson)['dependencies']> = [
	'@bifravst/from-env',
	'@bifravst/cloudformation-helpers',
]

export const pack = async (): Promise<PackedLayer> =>
	packLayer({ id: 'baseLayer', dependencies })
