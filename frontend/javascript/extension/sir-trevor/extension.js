define(['ImageServiceConfig'],function(ImageServiceConfig){

    return  function(options) {
        var that = this;
        var extensionUrl = options.extensionUrl;
        var serviceName = options.serviceName;
        var ImageServiceModel = options.model.imageService;
        var protoBlock = {

            imageServiceInstance: null,

            custom: {
                type: 'imageservice',
                label: 'Image'
            },

            type: 'imageservice',
            title: function() { return this.custom.label ? this.custom.label : 'Image'; },
            icon_name: 'default',
            toolbarEnabled: true,
            // Custom html that is shown when a block is being edited.
            textable: true,
            editorHTML: '<div class="prefix"></div><div class="frontend-target"></div><textarea type="text" class="data-target">{"items":[]}</textarea>',

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

                if(this.custom.label)
                    $(this.$('.prefix')).append($('<div class="block-title">'+ this.custom.label +'</div>'));

                var config = this.custom;
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

        /*that.init = function(blockOptions) {
            if( typeof(SirTrevor) == "object" ) {
                SirTrevor.Blocks.Imageservice = SirTrevor.Block.extend(protoBlock);
            }
        };*/

        that.init = function(options) {

            if(typeof(SirTrevor)) {
                Object.keys(options).forEach(function (block) {

                    if(!(options[block] instanceof Object))
                        return;

                    if(!(options[block].hasOwnProperty('type') || block=='Imageservice') )
                        return;

                    if(block!=='Imageservice' && options[block].type !== 'imageservice')
                        return;


                    var newBlock = {
                        type: block,
                        custom: options[block]
                    };

                    if (typeof(SirTrevor.Blocks[block]) === 'undefined') {
                        newBlock = jQuery.extend({}, protoBlock, newBlock);
                        SirTrevor.Blocks[block] = SirTrevor.Block.extend(newBlock);
                    }
                });
            }

        };

        return that;
    };

});
