import { ListBucketsCommand, S3Client } from '@aws-sdk/client-s3'
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { deleteS3Bucket } from './deleteS3Bucket.js'

// TODO: make SSM parameters
const ageInHours = 24

const s3 = new S3Client({})
const rmBucket = deleteS3Bucket(s3)
const ssm = new SSMClient({})

const { bucketNameRegexpParamName } = fromEnv({
	bucketNameRegexpParamName: 'BUCKET_NAME_REGEX_PARAMETER_NAME',
})(process.env)

const bucketNameRegexpPromise = (async () => {
	const res = await ssm.send(
		new GetParameterCommand({
			Name: bucketNameRegexpParamName,
		}),
	)

	return new RegExp(res.Parameter?.Value ?? /^asset-tracker-/)
})()

/**
 * find buckets to delete
 */
const findBucketsToDelete = async (): Promise<string[]> => {
	const { Buckets } = await s3.send(new ListBucketsCommand({}))

	const bucketNameRegexp = await bucketNameRegexpPromise

	if (Buckets === undefined) return []
	const foundParametersToDelete: string[] = Buckets.filter(({ Name }) =>
		bucketNameRegexp.test(Name ?? ''),
	)
		.filter(
			({ CreationDate }) =>
				Date.now() - (CreationDate?.getTime() ?? Date.now()) >
				ageInHours * 60 * 60 * 100,
		)
		.map(({ Name }) => Name as string)

	//  log groups
	const ignoredBuckets = Buckets?.filter(
		({ Name }) => !foundParametersToDelete.includes(Name ?? ''),
	).map(({ Name }) => Name)
	ignoredBuckets?.forEach((name) => console.log(`Ignored: ${name}`))
	return foundParametersToDelete
}

export const handler = async (): Promise<void> => {
	for (const bucketName of await findBucketsToDelete()) {
		console.log(`Deleting: ${bucketName}`)
		await rmBucket(bucketName)
	}
}
