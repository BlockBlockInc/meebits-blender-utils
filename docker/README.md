# Docker for meebits blender utils with a webserver for conversion
Provides access to convert meebits without installing blender locally & a server to upload converted files to the Meebits Google Drive

## Run Locally:
1. Install docker desktop https://docs.docker.com/get-docker/
2. Generate an API key for the `meebits-conversion` service account on the GCP console. GCP Console Home, `meebits-conversion` project -> IAM & Admin -> Service Accounts -> `meebits-conversion` service account -> Keys -> Add Key -> Create New Key -> JSON. Rename key to `google-service-account.json` and move to `./server/`
3. Build container: `docker build -t blender-meebits-server .`
4. Run container: `docker run -p 3000:3000 -d blender-meebits-server`. If you need to bash into the container: `docker exec -it <container id> /bin/bash`


## API Spec:
* Healthcheck: `GET /`
  * Response:
    ```
    {
        "status": "healthy"
    }
    ```

* Webhook: `POST /webhook`
  * Request:
    ```
    {
      "fileUrl": "https://cdn.discordapp.com/attachments/852231959358472222/860143902635196416/meebit_06895_t_solid.vox",
      "folderId": "1SJoFD5dkoUDBz4L9f48Sbt4-DImC0yIo"
    }
    ```
  * Response:
    ```
    {
        "result": [
            {
                "kind": "drive#file",
                "id": "1ii_v1nh_a8iCUQ26QZFSern5O2m91T_4",
                "name": "meebit_06895_t_solid.fbx",
                "mimeType": "application/octet-stream"
            },
            {
                "kind": "drive#file",
                "id": "1BVpwpxkH9zc9gihriajcNmRtIvPCTgTT",
                "name": "meebit_06895_t_solid.glb",
                "mimeType": "application/octet-stream"
            },
            {
                "kind": "drive#file",
                "id": "1h-upSckWhUwOvJ0W4ZAIvvp2YWtdWLNy",
                "name": "meebit_06895_t_solid.jpg",
                "mimeType": "image/jpeg"
            },
            {
                "kind": "drive#file",
                "id": "1gXxUkCjgTLnxq3DpF5mRxA1TsHq4Xr-o",
                "name": "meebit_06895_t_solid.mtl",
                "mimeType": "application/octet-stream"
            },
            {
                "kind": "drive#file",
                "id": "1kjrGSUruf7LBsYAs6fMrnUriYSLnX8xp",
                "name": "meebit_06895_t_solid.obj",
                "mimeType": "application/octet-stream"
            },
            {
                "kind": "drive#file",
                "id": "1uSvD-BHCrVawbFuZ7-z9eBj_03T6cGph",
                "name": "meebit_06895_t_solid.vrm",
                "mimeType": "x-world/x-vrml"
            }
        ]
    }
    ```

## Hosting

Hosted on AWS Fargate. `http://EC2Co-EcsEl-3BYW4DXWAV1I-750400994.us-east-1.elb.amazonaws.com:3000/webhook`
