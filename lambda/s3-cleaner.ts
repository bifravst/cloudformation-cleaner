import { ListBucketsCommand, S3Client } from '@aws-sdk/client-s3'
import { deleteS3Bucket } from './deleteS3Bucket'

const AGE_IN_HOURS = parseInt(process.env.AGE_IN_HOURS ?? '24', 10)

const BUCKET_NAME_REGEX =
	process.env.BUCKET_NAME_REGEX !== undefined
		? new RegExp(process.env.BUCKET_NAME_REGEX)
		: /^asset-tracker-/

const s3 = new S3Client({})

/**
 * Recursively find buckets to delete
 */
const findBucketsToDelete = async (
	limit = 100,
	bucketsToDelete: string[] = [],
): Promise<string[]> => {
	if (bucketsToDelete.length >= limit) return bucketsToDelete
	const { Buckets } = await s3.send(new ListBucketsCommand({}))
	if (Buckets !== undefined) {
		const foundBucketsToDelete: string[] = Buckets.filter(({ Name }) =>
			BUCKET_NAME_REGEX.test(Name ?? ''),
		)
			.filter(
				({ CreationDate }) =>
					Date.now() - (CreationDate?.getTime() ?? Date.now()) >
					AGE_IN_HOURS * 60 * 60 * 100,
			)
			.map(({ Name }) => Name as string)

		// Log ignored log groups
		const ignoredBuckets = Buckets?.filter(
			({ Name }) => !foundBucketsToDelete.includes(Name ?? ''),
		).map(({ Name }) => Name)
		ignoredBuckets?.forEach((name) => console.log(`Ignored: ${name}`))
		bucketsToDelete.push(...foundBucketsToDelete)
	}
	return bucketsToDelete
}

export const handler = async (): Promise<void> => {
	// Find old s3 buckets to delete
	const bucketsToDelete = await findBucketsToDelete()
	await bucketsToDelete.reduce(
		async (promise, BucketName) =>
			promise.then(async () => deleteS3Bucket(s3)(BucketName)),
		Promise.resolve(),
	)
}
