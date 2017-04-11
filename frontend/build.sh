#!/usr/bin/env bash

./node_modules/requirejs/bin/r.js -o build.js
./node_modules/requirejs/bin/r.js -o build.dev.js optimize=none
cp -r css ../web

##cp -r ../web/* ../../../../../public/extensions/vendor/cnd/imageservice/