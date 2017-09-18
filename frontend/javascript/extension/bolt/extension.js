var CnImageServiceBolt = {};
require(['ImageServiceConfig',
        'ImageServicePreview',
        'ImageServiceImageModelFactory',
        'ImageServiceMessaging'],
    function (ImageServiceConfig, ImageServicePreview, ImageServiceImageModelFactory, ImageServiceMessaging) {

        CnImageServiceBolt = new (function () {

            var that = this;
            var instances = [];
            var saved = 0;
            var failed = 0;
            var lastEvent = null;
            var loader = '<div class="imageservice-saving">Saving Images</div>';
            var collections = [];
            var messaging = null;
            var modal = $('<div class="buic-modal modal fade imageservice-progress" tabindex="-1" role="dialog" aria-labelledby="imageservice-progress">\n' +
                '  <div class="modal-dialog modal-lg" role="document">\n' +
                '     <div class="modal-content">' +
                '         <div class="modal-header"><h2 class="hide-on-error">Saving Images</h2><h2 class="show-on-error error">Saving Cancelled</h2></div>' +
                '         <div class="modal-body"></div>\n' +
                '         <div class="modal-footer show-on-error"><button type="button" class="btn btn-default" data-dismiss="modal">Close</button></div>\n' +
                '     </div>'+
                '  </div>\n' +
                '</div>\n');

            $('body').append(modal);

            // Listenes for saved events of the Instances, and when all are saved, fieres the save event of the original save button
            // The CnImageService Compoenent fires different events on list saved, or the list does not need saving
            $(document).on( ImageServiceConfig.events.LISTSAVED + ' ' + ImageServiceConfig.events.LISTSAVINGSKIPPED + ' ' + ImageServiceConfig.events.LISTSAVEFAILED , function (event, data) {

                if(event.type === ImageServiceConfig.events.LISTSAVEFAILED) {

                    failed++;

                    messaging.error(data.error || 'Unknown error occurred');

                    // Process unsaved images
                    if(data.hasOwnProperty('data') && data.data instanceof Array) {
                        that.savedError(data.data);
                    }

                } else {
                    saved--;
                    that.savedHide(data.items);
                }

                if (saved === 0) {

                    modal.modal('hide');
                    $('.imageservice-saving').hide();

                    $(lastEvent.target).data('parentButton').trigger(lastEvent.type, {
                        imageserviceskip: true
                    });

                } else if (saved - failed === 0 ) {
                    $('.imageservice-saving').hide();
                    that.savedError([]);
                    modal.find('.show-on-error').show();
                    modal.find('.hide-on-error').hide();
                }

            });

            // Listens for new ImageServiceFields
            $(document).on(ImageServiceConfig.events.LISTREADY, function (event, data) {
                instances.push(data.instance);
            });

            // Clones the save button to makes sure that we save the imageservice fields first
            $(window).on('load', function(){
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

                    $(loader).insertBefore(customButton);
                    $('.imageservice-saving').hide();

                });
            });

            /**
             * Calls all the instances and saves the data to the wished store
             * @param event
             * @param data
             */
            that.save = function (event, data) {

                $('.imageservice-saving').show();
                $('.imageservice-saving-progress-modal').html('');
                collections = [];

                lastEvent = event;
                saved = instances.length;
                failed = 0;

                // Gets the Data to save
                instances.forEach(function (instance) {
                    collections.push(instance.list.getData().items);
                });

                // Shows the Progress Modal
                that.showProgress();

                // Trigger Saving
                instances.forEach(function (instance) {
                    instance.save();
                });

            };

            that.savedHide = function(list) {
                list.forEach(function(item){
                    $('.modal-body').find('img[id="'+item.id.replace(/[^a-z0-9\_\-\.]+/i,'')+'"]').parent().hide();
                })
            };

            that.savedError = function(list) {

                if(!list.length) {
                    $('.modal-body img').removeClass('saving');
                    $('.modal-body img').addClass('error');
                    return;
                }

                list.forEach(function(item){
                    $('.imageservice-saving-progress-modal').find('img[id="'+item.id.replace(/[^a-z0-9\_\-\.]+/i,'')+'"]').each(function(){
                        $(this).removeClass('saving');
                        $(this).addClass('error');
                    });
                })
            };

            that.showProgress = function() {

                modal.find('.modal-body').html('');

                collections.forEach(function(collection){

                    collection.forEach(function(image){
                        var preview = new ImageServicePreview({
                            item: image,
                            config: {
                                events: ImageServiceConfig.events
                            },
                            factory: {
                                dataModel: ImageServiceImageModelFactory
                            }
                        });
                        var html = preview.render();
                        html.find('img').attr('style','-webkit-animation-duration: ' + (Math.random(7)+3) + 's');
                        html.find('img').addClass('saving');
                        modal.find('.modal-body').append(preview.render());
                    });
                });

                modal.find('.show-on-error').hide();
                modal.find('.hide-on-error').show();

                modal.modal({
                    show: true
                });

                messaging = new ImageServiceMessaging({
                    host: modal.find('.modal-body'),
                    events: ImageServiceConfig.events
                });

            }

        })();
    });
