# Blender docker file from https://hub.docker.com/r/nytimes/blender https://github.com/nytimes/rd-blender-docker

FROM nytimes/blender:latest

# Copy scripts
# Copy blender scene with aramature
# Copy VRM add-on
# All in one layer to current directory
COPY code/* code/MeebitRig.blend code/VRM_Addon_for_Blender-release.zip ./

# Install VRM add-on through our script
RUN blender -b  -y  --python blender_install_vrm_addon.py

# Copy server
COPY server/app.js server/google-service-account.json server/package.json server/yarn.lock ./

# Server setup
RUN mkdir meebits &&\
  mkdir output_vrm &&\
  chmod u+x convert_all_meebits.sh &&\
  apt-get update; apt-get -y install curl; apt-get -y install redis-server &&\
  curl -fsSL https://deb.nodesource.com/setup_14.x | bash - &&\
  apt-get install -y nodejs &&\
  npm install --global yarn &&\
  yarn --pure-lockfile &&\
  redis-server --daemonize yes

EXPOSE 3000

CMD redis-server --daemonize yes ; yarn start