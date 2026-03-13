import '@tensorflow/tfjs-backend-wasm'
import * as tf from '@tensorflow/tfjs-core'
import * as faceapi from '@vladmandic/face-api/dist/face-api.node-wasm.js'
import sharp from 'sharp'
import { join } from 'path'

async function test() {
  await tf.setBackend('wasm')
  await tf.ready()

  const modelsPath = join(__dirname, '../../../resources/models')
  console.log('Loading models from', modelsPath)
  
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelsPath)
  await faceapi.nets.faceLandmark68Net.loadFromDisk(modelsPath)
  await faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath)

  console.log('Models loaded, processing image...')
  
  // Create a fast pure-black image to test the API pipe
  const { data, info } = await sharp({
    create: {
      width: 400,
      height: 400,
      channels: 3,
      background: { r: 0, g: 0, b: 0 }
    }
  }).raw().toBuffer({ resolveWithObject: true })

  const tensor = faceapi.tf.tensor3d(Uint8Array.from(data), [info.height, info.width, 3], 'int32')
  
  console.log('Tensor created, running detection...')
  const result = await faceapi.detectSingleFace(tensor).withFaceLandmarks().withFaceDescriptor()
  
  console.log('Result:', result ? 'Face found' : 'No face found')
  tensor.dispose()
}

test().catch(console.error)
