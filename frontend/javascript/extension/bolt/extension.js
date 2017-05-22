require(['ImageServiceConfig'], function (ImageServiceConfig) {

    window.CnImageServiceBolt = new (function () {

        var that = this;
        var instances = [];
        var saved = 0;
        var lastEvent = null;

        // Listenes for saved events of the Instances, and when all are saved, fieres the save event of the original save button
        // The CnImageService Compoenent fires different events on list saved, or the list does not need saving
        $(document).on( ImageServiceConfig.events.LISTSAVED + ' ' + ImageServiceConfig.events.LISTSAVINGSKIPPED , function (event, data) {
            if (--saved == 0) {
                $(lastEvent.target).data('parentButton').trigger(lastEvent.type, {
                    imageserviceskip: true
                });
            }
        });

        // Listens for new ImageServiceFields
        $(document).on(ImageServiceConfig.events.LISTREADY, function (event, data) {
            instances.push(data.instance);
        });

        // Clones the save button to makes sure that we save the imageservice fields first
        $(document).ready(function(){
            $('#sidebarsavecontinuebutton, #savecontinuebutton').each(function(el){
                var customButton = $($(this).prop('outerHTML'));
                customButton.data('parentButton', $(this));
                customButton.attr('id', customButton.attr('id') + '-imageservice');
                customButton.insertBefore($(this));
                customButton.on('click', function(event){
                    event.stopPropagation();
                    event.preventDefault();
                    that.save(event); //customButton.data('parentButton').trigger('click');
                });
                $(this).hide();
            });
        });

        /**
         * Calls all the instances and saves the data to the wished store
         * @param event
         * @param data
         */
        that.save = function (event, data) {
            lastEvent = event;
            saved = instances.length;
            instances.forEach(function (instance) {
                instance.save();
            });
        };

    })();
});
