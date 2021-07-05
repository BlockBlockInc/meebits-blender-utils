# Blender docker file from https://hub.docker.com/r/nytimes/blender https://github.com/nytimes/rd-blender-docker

FROM nytimes/blender:latest

# Copy scripts
# Copy blender scene with aramature
# Copy VRM add-on
# All in one layer to current directory
copy code/* MeebitRig.blend code/VRM_Addon_for_Blender-release.zip ./

# Install VRM add-on through our script
run blender -b  -y  --python blender_install_vrm_addon.py

# Copy ser
copy server/app.js server/package.json server/google-service-account.json server/yarn.lock ./

# File setup
run mkdir meebits
run mkdir output_vrm
run chmod u+x convert_all_meebits.sh

# Install node
run apt-get update; apt-get -y install curl
run curl -fsSL https://deb.nodesource.com/setup_14.x | bash -
run apt-get install -y nodejs
run npm install --global yarn
run yarn --pure-lockfile

EXPOSE 3000

CMD [ "yarn", "start" ]