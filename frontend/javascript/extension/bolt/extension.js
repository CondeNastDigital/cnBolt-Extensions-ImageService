var CnImageServiceBolt = {};
require(['ImageServiceConfig',
        'ImageServicePreview',
        'ImageServiceImageModelFactory',
        'ImageServiceMessaging',
        'ImageServiceUniqueId'
    ],
    function (ImageServiceConfig, ImageServicePreview, ImageServiceImageModelFactory, ImageServiceMessaging, ImageServiceUniqueId) {

        CnImageServiceBolt = new (function () {

            var that = this;
            var instances = [];
            var saved = 0;
            var failed = 0;
            var lastEvent = null;
            var loader = '<div class="imageservice-saving">Saving Images</div>';
            var collections = [];
            var messaging = null;

            var idGenerator = new ImageServiceUniqueId('');
            var modal = $('<div class="buic-modal modal fade imageservice-progress" tabindex="-1" role="dialog" aria-labelledby="imageservice-progress">\n' +
                '  <div class="modal-dialog modal-lg" role="document">\n' +
                '     <div class="modal-content">' +
                '         <div class="modal-header"><h2 class="hide-on-error">Saving Images</h2><h2 class="show-on-error error">Saving Cancelled</h2></div>' +
                '         <div class="modal-body"></div>\n' +
                '         <div class="modal-footer show-on-error">' +
                '             <div class=\"error col-xs-12 col-md-8\">An error occured. Please remove or change the images marked with red and try again.</div>' +
                '             <div class=\"col-xs-12 col-md-4\"><button type="button" class="btn btn-default pull-right" data-dismiss="modal">Close</button></div>' +
                '         </div>\n' +
                '     </div>'+
                '  </div>\n' +
                '</div>\n');

            $('body').append(modal);

            // Listenes for saved events of the Instances, and when all are saved, fieres the save event of the original save button
            // The CnImageService Compoenent fires different events on list saved, or the list does not need saving
            $(document).on( ImageServiceConfig.events.LISTSAVED + ' '
                          + ImageServiceConfig.events.LISTSAVINGSKIPPED + ' '
                          //+ ImageServiceConfig.events.MESSAGEWARNING + ' '
                          + ImageServiceConfig.events.LISTSAVEFAILED ,
                function (event, data) {

                    if(event.type === ImageServiceConfig.events.LISTSAVEFAILED) {

                        failed++;

                        //messaging.error(data.error || 'Unknown error occurred');

                        // Process unsaved images
                        if (data.hasOwnProperty('data') && data.data instanceof Array) {
                            that.savedError(data.data);
                        }

                    } else {
                        saved--;
                        that.savedHide(data.items);
                    }

                    if (saved === 0)
                        that.finishSaving(true);
                    else if (saved - failed === 0 )
                        that.finishSaving(false);

                }
            );

            $(document).on( ImageServiceConfig.events.MESSAGEWARNING + ' ' +  ImageServiceConfig.events.MESSAGEERROR,
                function (event, warning) {
                    modal.find('img[id="'+warning.data.id+'"]').parent().addClass('error');
            });

            // Listens for new ImageServiceFields register
            $(document).on(ImageServiceConfig.events.LISTREADY, function (event, data) {
                instances.push(data.instance);
            });

            // Listens for new ImageServiceFields remove
            $(document).on(ImageServiceConfig.events.LISTREMOVED, function (event, data) {
                var index = instances.indexOf(data.instance);
                console.log(instances.indexOf(data.instance));
                if(index>-1)
                    instances.splice(index,1);
            });

            // Clones the save button to makes sure that we save the imageservice fields first
            // FIXME: The buttons id's change from time to time and need to be added here. In the future, bolt wants to provide events for this

            function changeSaveButton(){
                $('#sidebarsavecontinuebutton, #savecontinuebutton, #sidebarpreviewbutton, #previewbutton, '         // Button IDs for Bolt 3.0-3.2
                    + '#sidebar_save, #content_edit_save, #sidebar_preview, #content_edit_preview').each(function(el){   // Button IDs for Bolt 3.3+

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
            }

            changeSaveButton();

            $(window).on('load', changeSaveButton);

            /**
             *
             */
            that.finishSaving = function(successfull) {

                if(successfull) {
                    modal.modal('hide');
                    if(typeof($(lastEvent.target).data('parentButton')) !== 'undefined')
                        $(lastEvent.target).data('parentButton').trigger(lastEvent.type, {
                            imageserviceskip: true
                        });
                } else {
                    that.savedError([]);
                    modal.find('.show-on-error').show();
                    modal.find('.hide-on-error').hide();
                }

                $('.imageservice-saving').hide();
            };



            /**
             * Calls all the instances and saves the data to the wished store
             * @param event
             * @param data
             */
            that.save = function (event, data) {

                $('.imageservice-saving').show();
                $('.imageservice-saving-progress-modal').html('');

                var needsSaving = false;
                collections = [];

                lastEvent = event;
                saved = instances.length;
                failed = 0;

                // Gets the Data to save
                instances.forEach(function (instance) {
                    if(instance.needsSaving()){
                        collections.push(instance.list.getData().items);
                        needsSaving = true;
                    }
                });

                if(needsSaving) {
                    // Shows the Progress Modal
                    that.showProgress();

                    // Trigger Saving
                    instances.forEach(function (instance) {
                        instance.save();
                    });
                } else {
                    that.finishSaving(true);
                }

            };

            /**
             * Hide the saved images
             * @param list
             */
            that.savedHide = function(list) {
                list.forEach(function(item){
                    $('.modal-body').find('img[id="'+idGenerator.generate(item.id)+'"]').parent().hide();
                })
            };

            /**
             * Do things on error on saving
             * @param list
             */
            that.savedError = function(list) {

                if(!list.length) {
                    $('.modal-body img').removeClass('saving');
                    //$('.modal-body img').addClass('error');
                    return;
                }

                list.forEach(function(item){
                    $('.imageservice-saving-progress-modal').find('img[id="'+idGenerator.generate(item.id)+'"]').each(function(){
                        $(this).removeClass('saving');
                        $(this).addClass('error');
                    });
                })
            };

            /**
             * Shows the Modal windows for the Progress
             */
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

                /*messaging = new ImageServiceMessaging({
                    host: modal.find('.modal-body'),
                    events: ImageServiceConfig.events
                });*/

            }

        })();
    });
