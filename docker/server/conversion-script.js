import { google } from 'googleapis';
import * as path from 'path';
import * as fs from 'fs';
import * as child_process from 'child_process'
import * as util from 'util';

const auth = new google.auth.GoogleAuth({
  keyFile: `${path.resolve()}/google-service-account.json`,
  scopes: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/drive.file'],
});

const drive = google.drive({
  version: 'v3',
  auth, auth
});

const exec = util.promisify(child_process.exec);

async function main() {
  // Get folders before conversion started
  const q = "modifiedTime < '2021-06-10T06:24:00' and '13fS_kFurxjYxGSeNG3y1bq2m8sw-uPb4' in parents";
  const res = await drive.files.list({ pageSize: 1000, q });
  const folders = res.data.files.map(({ id }) => id);

  for (let i = 0; i < folders.length; i++) {
    // Get files in folders
    const folderId = folders[i];
    console.log("starting folder:", folderId);
    const q = `'${folderId}' in parents`
    const vrm_result = await drive.files.list({ pageSize: 1000, q });
    const files = vrm_result.data.files;

    for (let k = 0; k < files.length; k++) {
      const { id, name } = files[k];
      const filePath = `./meebits/${name}`;
      const dest = fs.createWriteStream(filePath);
      await new Promise((resolve, reject) => {
        drive.files.get(
          { fileId: id, alt: 'media' },
          { responseType: 'stream' },
          (err, res) => {
            res.data.on('end', () => resolve()).on('error', () => reject()).pipe(dest)
          }
        )
      })

      // Convert and upload
      try {
        console.log(`Running conversion for file: ${name}`)
        await exec('./convert_all_meebits.sh');
        await exec(`rm ./meebits/${name}`);
      } catch (e) {
        const errMessage = `Error converting file ${name}`;
        console.error(errMessage)
        console.error(e);
        return;
      }

      const meebitBaseFileName = name.split('.')[0];
      const extensions = ['.fbx', '.glb', '.jpg', '.mtl', '.obj', '.vrm'];

      for (let i = 0; i < extensions.length; i++) {
        const convertedFileName = `${meebitBaseFileName}${extensions[i]}`;
        const convertedFilePath = `./output_vrm/${convertedFileName}`

        if (!fs.existsSync(convertedFilePath)) {
          console.error(`File not found: ${convertedFileName} - not uploading`);
          break;
        }

        console.log(`Starting upload: ${convertedFileName}`)
        await drive.files.create({
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
          return;
        });
        await exec(`rm ./output_vrm/${convertedFileName}`);
        console.log(`Done upload: ${convertedFileName}`)
      }
      console.log(`Done uploading file: ${name}`)

    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });