
import express, { json } from 'express';
import cors from 'cors';
import { google, ml_v1 } from 'googleapis';
import { initializeApp } from 'firebase-admin/app';
import fetch from 'node-fetch';
import morgan from 'morgan';
import * as path from 'path';
// import * as fs from 'fs-extra';
import * as util from 'util';
import * as child_process from 'child_process'
import Queue from 'bee-queue'
import fileUpload from 'express-fileupload';
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const admin = require("firebase-admin");

const fs = require('fs-extra');

const gsaJson = fs.readFileSync('./google-service-account.json');
const serviceAccount = JSON.parse(gsaJson);

// ---------------- Exec Setup ----------------
const exec = util.promisify(child_process.exec);

// ---------------- Express Setup ----------------
const app = express();
app.use(express.json());
app.use(cors());

// ---------------- FileUpload ----------------
app.use(fileUpload({
  useTempFiles: true, 
  tempFileDir: '/tmp/'
}));

// ---------------- Google Cloud ----------------
initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "gs://meebits-1653f.appspot.com"
});

const defaultBucket = admin.storage().bucket();

// ---------------- Queue Setup ----------------
const options = {
  removeOnSuccess: true,
}

const conversionQueue = new Queue('conversion', options);
const uploadQueue = new Queue('upload', options);

conversionQueue.on('ready', () => {
  console.log('Conversion queue ready');
});
uploadQueue.on('ready', () => {
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


// ---------------- Conversion for Photobooth ----------------
const photoboothOptions = {
  removeOnSuccess: true,
}

const photoboothConversionQueue = new Queue('photobooth', photoboothOptions);

photoboothConversionQueue.on('ready', () => {
  console.log('Photobooth Conversion queue ready!');
});

function addPhotoboothConversionJob(meebit) {
  return photoboothConversionQueue
    .createJob(meebit)
    .retries(3)
    .save();
}

async function moveFiles(oldPath, newPath) {
  try {
    console.log(oldPath, newPath);

    fs.move(oldPath, newPath, (err) => {
      if(err){
        console.log(err);
        const errMessage = `Error moving ${newPath} to new directory.`;
        return Promise.reject(new Error(errMessage));
      }  
    });

  } catch (e) {
    return Promise.reject(new Error(e));
  }

  return true; 
}

async function executeConversion(meebitBaseFileName) {
  const {err, stdout, stderr} = await exec('./convert_all_meebits.sh');

  if(err){
    console.log(`exec error: ${err}`);
    await exec(`rm -rf ./output_vrm/${meebitBaseFileName}.*`);
    return Promise.reject(new Error(`Error converting file ${meebitBaseFileName}`));
  }

  return true; 
}

async function checkFiles(meebitBaseFileName) {
  const extensions = ['.fbx', '.glb', '.jpg', '.mtl', '.obj', '.vrm'];

  for(let i = 0; i < extensions.length; i++) {
    const extension = extensions[i];

    const convertedFileName = `${meebitBaseFileName}${extension}`;

    console.log("Extension", extension);
    console.log("ConvertedFiledName", convertedFileName);

    if (!fs.pathExists(`./output_vrm/${convertedFileName}`)) {
      const errMessage = `Error with conversion script, file ${meebitBaseFileName}`;
      console.log(errMessage)
      return Promise.reject(new Error(errMessage));
    }else{
      console.log(`This path exists ${convertedFileName}`);
    }
  }

  return true; 
}

async function exportOutputFiles(meebitBaseFileName) {
  // Get VRM file 
  const files = await fs.readdir('./output_vrm');

  try{
    for(let i = 0; i < files.length; i++){
      const file = files[i];
      const filename = path.basename(file);
      const storageDestination = `convertedFiles/${meebitBaseFileName}/${filename}`;
      const fileSource = `./output_vrm/${file}`;

      console.log(i, file, filename, storageDestination, fileSource);

      defaultBucket.upload(fileSource, {
        destination: storageDestination
      });
    }
  }catch(e){
    return Promise.reject(new Error(e));
  }
}

async function exportVrmFiles(meebitBaseFileName) {
  const fileSource = `./output_vrm/${meebitBaseFileName}.vrm`;
  
  try{
    if(fs.pathExists(fileSource)) {
      console.log("File Exists.");

      if(meebitBaseFileName[7] === "0"){
        const meebitId = meebitBaseFileName.substring(7, meebitBaseFileName.length - 8);
        const stripZerosId = parseInt(meebitId).toString();

        const newPath = `./output_vrm/meebit_${stripZerosId}_t.vrm`;
        
        try{
          await fs.copyFile(fileSource, newPath);
        }catch(e){
          return Promise.reject(new Error(e));
        }

        const storageDestination = `meebits/meebit_${stripZerosId}_t.vrm`;

        defaultBucket.upload(`./output_vrm/meebit_${stripZerosId}_t.vrm`, {
          destination: storageDestination
        });
      }else{
        //remove solid
        const removeSolid = meebitBaseFileName.substring(0, meebitBaseFileName.length-6);

        const newPath = `./output_vrm/${removeSolid}.vrm`;

        console.log(removeSolid, newPath);
        
        try{
          await fs.copyFile(fileSource, newPath);
        }catch(e){
          return Promise.reject(new Error(e));
        }
        
        const storageDestination = `meebits/${removeSolid}.vrm`;

        defaultBucket.upload(`./output_vrm/${removeSolid}.vrm`, {
          destination: storageDestination
        });
      }
    }
  }catch(e){
    return Promise.reject(new Error(e));
  }
}

async function deleteFiles(meebitBaseFileName) {
  try{
    await exec(`rm -rf ./meebits/${meebitBaseFileName}.vox`);
  }catch(e){
    console.log(e);
    return Promise.reject(new Error(`Error removing ${meebitBaseFileName} file`));
  }

  return true; 
}

async function deleteOutputFiles(meebitBaseFileName){
  try{
    await exec(`rm -rf ./output_vrm/${meebitBaseFileName}.*`);
  }catch(e){
    console.log(e);
    return Promise.reject(new Error(`Error removing ${meebitBaseFileName} file`));
  }
  
  return true;
}

async function deleteFormatedOutputFile(meebitBaseFileName){
  const removeSolid = meebitBaseFileName.substring(0, meebitBaseFileName.length-6);

  if(removeSolid[7] === "0"){
    const meebitId = removeSolid.substring(7, removeSolid.length - 2);
    const stripZerosId = parseInt(meebitId).toString();
    console.log(`Deleting meebit_${stripZerosId}_t.vrm`);

    try{
      await exec(`rm -rf ./output_vrm/meebit_${stripZerosId}_t.*`);
    }catch(e){
      console.log(e);
      return Promise.reject(new Error(`Error removing ${meebitBaseFileName} file`));
    }
  }else{
    try{
      await exec(`rm -rf ./output_vrm/${removeSolid}.*`);
    }catch(e){
      console.log(e);
      return Promise.reject(new Error(`Error removing ${meebitBaseFileName} file`));
    }
  }

  return true;
}

photoboothConversionQueue.process(async (job, done) => {
  console.log("------ Entering photobooth queue -------");
  const { uploadedFile } = job.data;

  const filename = uploadedFile.name; 
  const tempPath = uploadedFile.tempFilePath;
  const meebitBaseFileName = filename.split('.')[0];

  const oldPath = tempPath;
  const newPath = path.resolve('./meebits', path.basename(filename));

  try{
    console.log("------ MOVING FILES -------");
    await moveFiles(oldPath, newPath); 
  }catch(e){
    return Promise.reject(new Error(e));
  }

  try{
    console.log("------ Executing Conversion -------");

    await executeConversion(meebitBaseFileName); 
  }catch(e){
    return Promise.reject(new Error(e));
  }

  try{
    console.log("------ Checking Files -------");

    await checkFiles(meebitBaseFileName); 
  }catch(e){
    return Promise.reject(new Error(e));
  }

  try{
    console.log("------ Export Output Files -------");

    await exportOutputFiles(meebitBaseFileName); 
  }catch(e){
    return Promise.reject(new Error(e));
  }

  try{
    console.log("------ Export VRM File -------");

    await exportVrmFiles(meebitBaseFileName); 
  }catch(e){
    return Promise.reject(new Error(e));
  }

  try{
    console.log("------ Deleting VRM File -------");

    await deleteFiles(meebitBaseFileName); 
  }catch(e){
    return Promise.reject(new Error(e));
  }

  try{
    console.log("------ Deleting Output VRM Files -------");

    await deleteOutputFiles(meebitBaseFileName); 
  }catch(e){
    return Promise.reject(new Error(e));
  }

  try{
    console.log("------ Deleting Formated Output VRM File -------");

    await deleteFormatedOutputFile(meebitBaseFileName); 
  }catch(e){
    return Promise.reject(new Error(e));
  }

  console.log("------ Completed -------");

  return done(null, {status: "done"});
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
    addConversionJob({ fileUrl, folderId, meebitFileName });
  } catch {
    res.status(500).send({ error: "Something went wrong, check the logs and try again" });
  }
  res.send({ status: "processing" });
});

app.post('/photobooth', async (req, res) => {
  const uploadedFile = req.files.file;
  
  try{
    addPhotoboothConversionJob({ uploadedFile });
  }catch{
    res.status(500).send({ error: "Something went wrong, check the logs and try again" });
  }

  photoboothConversionQueue.on('succeeded', () => {
    if(!res.headersSent){
      res.send({status: "done"});
    }
  });

  photoboothConversionQueue.on('error', (err) => {
    console.log('error', err);

    if(!res.headersSent){
      res.send({status: "error"});
    }
  });
});

// ---------------- Start Server ----------------
app.listen(process.env.PORT || 3000, () => console.log(`🚀 Server ready`));
 