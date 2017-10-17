define(['ImageServiceConfig'],function(ImageServiceConfig){

    return  function(options) {
        var that = this;
        var extensionUrl = options.extensionUrl;
        var serviceName = options.serviceName;
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
                $(this.$('.data-target')).text(JSON.stringify(data));

            },

            /**
             * Sets the data form the ImageService into the Block store
             */
            save: function(){

                if(!this.imageServiceInstance)
                    return;

                var listData = this.imageServiceInstance.list.getData();
                var settingsData = this.imageServiceInstance.settings.getData();

                this.setData(Object.assign({}, settingsData, {items: listData.items}));

            },

            /**
             * Creates the new image service block
             */
            onBlockRender: function() {

                // Gives the container an unique id
                $(this.$('.frontend-target')).attr('id', 'ImageService' + String(new Date().valueOf()));

                var config = SirTrevor.getInstance(this.instanceID).options.options.Imageservice || {};
                // Merges the Field config with the defaults
                var defaults = {
                    dataElement: this.$('.data-target'),
                    hostElement: this.$('.frontend-target'),
                    serviceUrl: extensionUrl + '/image',
                    serviceName: config.service || serviceName
                };

                // Inits the Image Service
                var customInstance = new ImageServiceModel(Object.assign(config, defaults ));

                this.imageServiceInstance = customInstance;
            },

            /**
             * Remove the ImageService Block from saving
             * @param e
             */
            onDeleteConfirm: function(e) {
                e.preventDefault();
                $(document).trigger( ImageServiceConfig.events.LISTREMOVED, { instance: this.imageServiceInstance });
                this.mediator.trigger('block:remove', this.blockID, {focusOnPrevious: true});
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




