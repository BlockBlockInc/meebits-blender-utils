
import express from 'express';
import cors from 'cors';
import { google } from 'googleapis';
import fetch from 'node-fetch';
import * as path from 'path';
import * as fs from 'fs';
import * as util from 'util';
import * as child_process from 'child_process'


const app = express();
app.use(express.json());
app.use(cors())

const exec = util.promisify(child_process.exec);

const auth = new google.auth.GoogleAuth({
  keyFile: `${path.resolve()}/google-service-account.json`,
  scopes: ['https://www.googleapis.com/auth/drive.file'],
});

const service = google.drive({
  version: 'v3',
  auth, auth
});

app.post('/webhook', async (req, res) => {
  try {
    const { fileUrl, folderId } = req.body;
    const meebitFileName = fileUrl.split('/').pop();
    const destination = fs.createWriteStream(`./meebits/${meebitFileName}`);
    const response = await fetch(fileUrl)
    response.body.pipe(destination);

    await exec('./convert_all_meebits.sh');
    await exec(`rm ./meebits/${meebitFileName}`);

    const meebitBaseFileName = meebitFileName.split('.')[0];
    const extensions = ['.fbx', '.glb', '.jpg', '.mtl', '.obj', '.vrm'];

    let results = [];
    for (let i = 0; i < extensions.length; i++) {
      const convertedFileName = `${meebitBaseFileName}${extensions[i]}`;
      const result = await service.files.create({
        requestBody: {
          name: convertedFileName,
          parents: [folderId]
        },
        media: {
          body: fs.createReadStream(`./output_vrm/${convertedFileName}`),
        }
      }).catch(e => {
        console.error(e);
        res.status(500).send(e.message);
        return;
      });
      results.push(result.data);
      await exec(`rm ./output_vrm/${convertedFileName}`);
    }
    return res.send({ result: results });
  } catch (e) {
    console.error(e);
    res.status(500).send();
  }
});

app.get('/', async (req, res) => {
  res.send({ status: "healthy" })
});

app.listen(process.env.PORT || 3000, () => console.log(`🚀 Server ready`));
