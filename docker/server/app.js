
import express from 'express';
import cors from 'cors';
import { google } from 'googleapis';
import fetch from 'node-fetch';
import morgan from 'morgan';
import * as path from 'path';
import * as fs from 'fs';
import * as util from 'util';
import * as child_process from 'child_process'

const app = express();
app.use(express.json());
app.use(cors());

const exec = util.promisify(child_process.exec);

const auth = new google.auth.GoogleAuth({
  keyFile: `${path.resolve()}/google-service-account.json`,
  scopes: ['https://www.googleapis.com/auth/drive.file'],
});

const service = google.drive({
  version: 'v3',
  auth, auth
});

app.get('/', async (req, res) => {
  res.send({ status: "healthy" })
});

// Enable logging after healthcheck route so logs don't get polluted
app.use(morgan('tiny'));

app.post('/webhook', async (req, res) => {

  const { fileUrl, folderId } = req.body;
  const meebitFileName = fileUrl.split('/').pop();
  console.log(`Downloading file: ${meebitFileName}`)
  try {
    const destination = fs.createWriteStream(`./meebits/${meebitFileName}`);
    const response = await fetch(fileUrl)
    response.body.pipe(destination);
  } catch (e) {
    const errMessage = `Error downloading file ${meebitFileName}`;
    console.error(errMessage)
    console.error(e);
    res.status(500).send({ message: errMessage });
    return;
  }
  try {
    console.log(`Running conversion for file: ${meebitFileName}`)
    await exec('./convert_all_meebits.sh');
    await exec(`rm ./meebits/${meebitFileName}`);
  } catch (e) {
    const errMessage = `Error converting file ${meebitFileName}`;
    console.error(errMessage)
    console.error(e);
    res.status(500).send({ message: errMessage });
    return;
  }

  res.send({ file: meebitFileName });

  const meebitBaseFileName = meebitFileName.split('.')[0];
  const extensions = ['.fbx', '.glb', '.jpg', '.mtl', '.obj', '.vrm'];

  for (let i = 0; i < extensions.length; i++) {
    const convertedFileName = `${meebitBaseFileName}${extensions[i]}`;
    const convertedFilePath = `./output_vrm/${convertedFileName}`

    if (!fs.existsSync(convertedFilePath)) {
      console.error(`File not found: ${convertedFileName} - not uploading`);
      break;
    }

    console.log(`Starting upload: ${convertedFileName}`)
    await service.files.create({
      requestBody: {
        name: convertedFileName,
        parents: [folderId]
      },
      media: {
        body: fs.createReadStream(convertedFilePath),
      }
    }).catch(e => {
      console.error(`Error uploading ${convertedFileName}`)
      console.error(e);
      res.status(500).send(e.message);
      return;
    });
    await exec(`rm ./output_vrm/${convertedFileName}`);
    console.log(`Done upload: ${convertedFileName}`)
  }
  console.log(`Done uploading file: ${meebitFileName}`)
});

app.listen(process.env.PORT || 3000, () => console.log(`🚀 Server ready`));
