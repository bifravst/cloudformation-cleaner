import * as childProcess from 'child_process'
import * as fs from 'fs'
import { promises as fsAsync } from 'fs'
import { writeFile } from 'fs/promises'
import * as glob from 'glob'
import * as path from 'path'
import * as yazl from 'yazl'
import { App } from './App'

const STACK_NAME = process.env.STACK_NAME ?? 'cloudformation-cleaner'
const lambdaDir = path.resolve(process.cwd(), 'dist', 'lambda')
const layerDir = path.resolve(process.cwd(), 'dist', 'layer')
const layerZipFileLocation = path.resolve(process.cwd(), 'dist', 'layer.zip')

const main = async () => {
	await writeFile(
		path.join(lambdaDir, 'package.json'),
		JSON.stringify({ type: 'module' }),
		'utf-8',
	)
	try {
		await fsAsync.mkdir(layerDir, { recursive: true })
	} catch {
		// pass
	}
	await Promise.all([
		fsAsync.copyFile(
			path.resolve(process.cwd(), 'package.json'),
			path.resolve(layerDir, 'package.json'),
		),
		fsAsync.copyFile(
			path.resolve(process.cwd(), 'package-lock.json'),
			path.resolve(layerDir, 'package-lock.json'),
		),
	])
	console.debug('Installing dependencies in layer ...')
	await new Promise<void>((resolve, reject) => {
		const p = childProcess.spawn(
			'npm',
			[
				'ci',
				'--ignore-scripts',
				'--omit=dev',
				'--no-audit',
				'--legacy-peer-deps',
			],
			{
				cwd: layerDir,
			},
		)
		p.on('close', (code) => {
			if (code !== 0) {
				return reject(new Error(`Install exited with code ${code}.`))
			}
			return resolve()
		})
		// p.stdout.on('data', (data) => console.debug(data.toString()))
		p.stderr.on('data', (data) => console.error(data.toString()))
	})
	await new Promise<void>((resolve) => {
		const zipfile = new yazl.ZipFile()
		const files = glob.sync(`${layerDir}${path.sep}**${path.sep}*`)
		files.forEach((file) => {
			if (fs.statSync(file).isFile()) {
				zipfile.addFile(
					file,
					file.replace(`${layerDir}${path.sep}`, `nodejs${path.sep}`),
				)
			}
		})
		zipfile.outputStream
			.pipe(fs.createWriteStream(layerZipFileLocation))
			.on('close', () => {
				console.debug(`Layer written to ${layerZipFileLocation}`)
				resolve()
			})
		zipfile.end()
	})

	new App({
		stackName: STACK_NAME,
		layerZipFileLocation,
	}).synth()
}

void main()
