import {
	DeleteBucketCommand,
	DeleteObjectsCommand,
	GetBucketLocationCommand,
	HeadBucketCommand,
	ListObjectsCommand,
	S3Client,
} from '@aws-sdk/client-s3'

export const deleteS3Bucket =
	(s3: S3Client) =>
	async (Bucket: string): Promise<void> => {
		try {
			const location = await s3.send(
				new GetBucketLocationCommand({
					Bucket,
				}),
			)

			console.log(`Deleting S3 Bucket: ${Bucket}`)
			const s3InRegion = new S3Client({ region: location.LocationConstraint })

			// Make sure it still exists
			await s3InRegion.send(
				new HeadBucketCommand({
					Bucket,
				}),
			)

			// Delete Items
			await s3InRegion
				.send(new ListObjectsCommand({ Bucket }))
				.then(async ({ Contents }) => {
					if (Contents)
						await s3.send(
							new DeleteObjectsCommand({
								Bucket,
								Delete: {
									Objects: Contents.map(({ Key }) => ({
										Key: Key as string,
									})),
								},
							}),
						)

					// Delete Bucket
					return s3InRegion.send(new DeleteBucketCommand({ Bucket }))
				})
				.catch((err) => {
					console.debug(`Failed to delete bucket ${Bucket}: ${err.message}`)
				})
		} catch (err) {
			console.error(err)
			console.error((err as Error).message)
			console.log(`Bucket ${Bucket} does not exist.`)
		}
	}
