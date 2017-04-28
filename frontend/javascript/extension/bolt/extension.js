var CnImageServiceBolt = {};
require(['ImageServiceConfig'], function (ImageServiceConfig) {

    CnImageServiceBolt = new (function () {

        var that = this;
        var instances = [];
        var saved = 0;
        var boltSaveEvent = null;
        var lastEvent = null;

        $(document).on( ImageServiceConfig.events.LISTSAVED + ' ' + ImageServiceConfig.events.LISTSAVINGSKIPPED , function (event, data) {
            if (--saved == 0) {
                $(lastEvent.target).trigger(lastEvent.type, {
                    imageserviceskip: true
                });
            }
        });

        $(document).on(ImageServiceConfig.events.LISTREADY, function (event, data) {
            instances.push(data.instance);
        });

        $(document).on('click', '#sidebarsavecontinuebutton, #savecontinuebutton' ,function (event, data) {
            if(!data || !data.hasOwnProperty('imageserviceskip')) {
                event.stopPropagation();
                event.preventDefault();
                lastEvent = event;
                that.save(event);
            }
        });

        that.save = function (event) {

            saved = instances.length;

            instances.forEach(function (instance) {
                instance.save();
            });

        };

    })();
});
