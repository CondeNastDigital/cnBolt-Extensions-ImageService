define(function(){

    return  function(options) {
        var that = this;
        var extensionUrl = options.extensionUrl;
        var ImageServiceModel = options.model.imageService;
        var protoBlock = {

            imageServiceInstance: null,

            type: 'imageservice',
            title: function() { return 'Image'; },
            icon_name: 'default',
            toolbarEnabled: true,
            // Custom html that is shown when a block is being edited.
            textable: true,
            editorHTML: '<div class="frontend-target"></div><textarea type="text" class="data-target">{"items":[]}</textarea>',

            /**
             * Loads the json data in to the field
             * @param data
             */
            loadData: function(data){
                data = data || { items:[] };
                $(this.$('.data-target')).html(JSON.stringify(data));

            },

            /**
             * Sets the data form the ImageService into the Block store
             */
            save: function(){

                if(!this.imageServiceInstance)
                    return;

                var data = $.merge(
                    {
                        settings: this.imageServiceInstance.settings.getData()
                    },
                    this.imageServiceInstance.list.getData()
                );

                this.setData(data);

            },

            /**
             * Creates the new image service block
             */
            onBlockRender: function() {

                // Gives the container an unique id
                $(this.$('.frontend-target')).attr('id', 'ImageService' + String(new Date().valueOf()));

                // Merges the Field config with the defaults
                var defaults = {
                    dataElement: this.$('.data-target'),
                    hostElement: this.$('.frontend-target'),
                    serviceUrl: extensionUrl + '/image'
                };
                var config = SirTrevor.getInstance(this.instanceID).options.options.Imageservice || {};

                // Inits the Image Service
                var customInstance = new ImageServiceModel(Object.assign(config, defaults ));

                // Adds the on-save
                // TODO: Replace with a better event/catchcancel process
                $('#sidebarsavecontinuebutton, #savecontinuebutton').bind('click', {} ,function (event) {
                    customInstance.onSave(event);
                });

                this.imageServiceInstance = customInstance;

            }
        };

        that.init = function(blockOptions) {
            if( typeof(SirTrevor) == "object" ) {
                SirTrevor.Blocks.Imageservice = SirTrevor.Block.extend(protoBlock);
            }
        };

        return that;
    };

});




