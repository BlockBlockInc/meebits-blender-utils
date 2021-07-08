
import express from 'express';
import cors from 'cors';
import { google } from 'googleapis';
import fetch from 'node-fetch';
import morgan from 'morgan';
import * as path from 'path';
import * as fs from 'fs';
import * as util from 'util';
import * as child_process from 'child_process'
import Queue from 'bee-queue'
import { doesNotMatch } from 'assert';

// ---------------- Exec Setup ----------------
const exec = util.promisify(child_process.exec);

// ---------------- Express Setup ----------------
const app = express();
app.use(express.json());
app.use(cors());

// ---------------- Google Setup ----------------
const auth = new google.auth.GoogleAuth({
  keyFile: `${path.resolve()}/google-service-account.json`,
  scopes: ['https://www.googleapis.com/auth/drive.file'],
});

const service = google.drive({
  version: 'v3',
  auth, auth
});

// ---------------- Queue Setup ----------------
const options = {
  removeOnSuccess: true,
}
const conversionQueue = new Queue('conversion', options);
const uploadQueue = new Queue('upload', options);
conversionQueue.on('ready', () => {
  console.log('Conversion queue ready');
});
conversionQueue.on('ready', () => {
  console.log('Upload queue ready');
});

function addConversionJob(meebit) {
  return conversionQueue
    .createJob(meebit)
    .retries(3)
    .save();
}

function addUploadJob(meebit_converted) {
  return uploadQueue
    .createJob(meebit_converted)
    .retries(5)

    .save();
}

conversionQueue.process(async (job) => {
  const { fileUrl, folderId, meebitFileName } = job.data;
  const meebitBaseFileName = meebitFileName.split('.')[0];
  const extensions = ['.fbx', '.glb', '.jpg', '.mtl', '.obj', '.vrm'];
  console.log(`Conversion Queue starting: job ${job.id}, file ${meebitFileName}, folder ${folderId}`);
  // Download
  try {
    const destination = fs.createWriteStream(`./meebits/${meebitFileName}`);
    const response = await fetch(fileUrl)
    response.body.pipe(destination);
  } catch (e) {
    const errMessage = `Error downloading file ${meebitFileName}`;
    console.log(errMessage)
    console.log(e);
    return Promise.reject(new Error(errMessage));
  }

  // Convert
  try {
    await exec('./convert_all_meebits.sh');
    extensions.map(extension => {
      // Check if all files exist, if not convert script failed.
      const convertedFileName = `${meebitBaseFileName}${extension}`;
      if (!fs.existsSync(`./output_vrm/${convertedFileName}`)) {
        const errMessage = `Error with conversion script, file ${meebitFileName}`;
        console.log(errMessage)
        console.log(e);
        return Promise.reject(new Error(errMessage));
      }
    });
  } catch (e) {
    const errMessage = `Error converting file ${meebitFileName}`;
    console.log(errMessage)
    console.log(e);
    await exec(`rm ./output_vrm/${meebitBaseFileName}.*`);
    return Promise.reject(new Error(errMessage));
  } finally {
    await exec(`rm ./meebits/${meebitFileName}`);
  }

  // Add to upload queue
  try {
    extensions.map(extension => {
      const convertedFileName = `${meebitBaseFileName}${extension}`;
      addUploadJob({
        folderId, convertedFileName
      });
    });
  } catch (e) {
    const errMessage = `Error adding to upload queue file ${meebitFileName}`;
    console.log(errMessage)
    console.log(e);
    return Promise.reject(new Error(errMessage));
  }

  console.log(`Conversion Queue done: job ${job.id}, file ${meebitFileName}, folder ${folderId}`);
  return { status: "done" }

});

uploadQueue.process(async (job) => {
  const { folderId, convertedFileName } = job.data;
  const convertedFilePath = `./output_vrm/${convertedFileName}`
  console.log(`Upload Queue starting: job ${job.id}, file ${convertedFileName}, folder ${folderId}`);

  try {
    await service.files.create({
      requestBody: {
        name: convertedFileName,
        parents: [folderId]
      },
      media: {
        body: fs.createReadStream(convertedFilePath),
      }
    });
  } catch (e) {
    const errMessage = `Error uploading file ${convertedFileName}`;
    console.log(errMessage)
    console.log(e);
    return Promise.reject(new Error(errMessage));
  }
  await exec(`rm ${convertedFilePath}`);
  console.log(`Upload Queue done: job ${job.id}, file ${convertedFileName}, folder ${folderId}`);
  return { status: "done" }

});

// ---------------- Express Routes ----------------

app.get('/', async (req, res) => {
  res.send({ status: "healthy" });
});

// Enable logging after healthcheck route so logs don't get polluted
app.use(morgan('tiny'));

app.post('/webhook', async (req, res) => {
  const { fileUrl, folderId } = req.body;
  const meebitFileName = fileUrl.split('/').pop();
  try {
    addConversionJob({ fileUrl, folderId, meebitFileName })
  } catch {
    res.status(500).send({ error: "Something went wrong, check the logs and try again" });
  }
  res.send({ status: "processing" });
});

// ---------------- Start Server ----------------
app.listen(process.env.PORT || 3000, () => console.log(`🚀 Server ready`));
