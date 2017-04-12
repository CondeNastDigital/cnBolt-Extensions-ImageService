#!/usr/bin/env bash

./node_modules/requirejs/bin/r.js -o build.js
./node_modules/requirejs/bin/r.js -o build.dev.js optimize=none
cp -r css ../web

DIRECTORY=../../../../../public/extensions/vendor/cnd/imageservice/

if [ -d "$DIRECTORY" ]; then
    cp -r ../web/* $DIRECTORY
fi
