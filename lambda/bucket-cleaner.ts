import { ListBucketsCommand, S3Client } from '@aws-sdk/client-s3'
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'
import { fromEnv } from '@bifravst/from-env'
import { deleteS3Bucket } from './deleteS3Bucket.js'

// TODO: make SSM parameters
const ageInHours = 24

const s3 = new S3Client({})
const rmBucket = deleteS3Bucket(s3)
const ssm = new SSMClient({})

const { bucketNameRegexpParamName } = fromEnv({
	bucketNameRegexpParamName: 'BUCKET_NAME_REGEX_PARAMETER_NAME',
})(process.env)

const bucketNamePatternPromise = (async () => {
	const res = await ssm.send(
		new GetParameterCommand({
			Name: bucketNameRegexpParamName,
		}),
	)

	return res.Parameter?.Value ?? `^asset-tracker-`
})()

/**
 * find buckets to delete
 */
const findBucketsToDelete = async (): Promise<{
	pattern: string
	buckets: string[]
}> => {
	const { Buckets } = await s3.send(new ListBucketsCommand({}))

	const bucketNamePattern = await bucketNamePatternPromise

	if (Buckets === undefined)
		return {
			pattern: bucketNamePattern,
			buckets: [],
		}
	const bucketNamePatternRegExp = new RegExp(bucketNamePattern)
	const foundParametersToDelete: string[] = Buckets.filter(({ Name }) =>
		bucketNamePatternRegExp.test(Name ?? ''),
	)
		.filter(
			({ CreationDate }) =>
				Date.now() - (CreationDate?.getTime() ?? Date.now()) >
				ageInHours * 60 * 60 * 1000,
		)
		.map(({ Name }) => Name as string)

	//  log groups
	const ignoredBuckets = Buckets?.filter(
		({ Name }) => !foundParametersToDelete.includes(Name ?? ''),
	).map(({ Name }) => Name)
	ignoredBuckets?.forEach((name) => console.log(`Ignored: ${name}`))
	return {
		pattern: bucketNamePattern,
		buckets: foundParametersToDelete,
	}
}

export const handler = async (): Promise<{
	pattern: string
	resources: string[]
}> => {
	const { buckets, pattern } = await findBucketsToDelete()
	for (const bucketName of buckets) {
		console.log(`Deleting: ${bucketName}`)
		await rmBucket(bucketName)
	}

	return {
		resources: buckets,
		pattern,
	}
}
