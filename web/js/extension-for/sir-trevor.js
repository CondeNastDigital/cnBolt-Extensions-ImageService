
if(typeof(SirTrevor)) {

    var extensionUrl = document.currentScript.getAttribute('data-extension-url');

    SirTrevor.Blocks.Imageservice = SirTrevor.Block.extend({

        imageServiceInstance: null,

        type: 'imageservice',
        title: function() { return 'Imageservice'; },
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

            this.setData(this.imageServiceInstance.list.getData());

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
            var config = SirTrevor.config.defaults.extend.Imageservice || {};

            // Inits the Image Service
            var customInstance = new CnImageService(Object.assign(config, defaults ));

            // Adds the on-save
            // TODO: Replace with a better event/catchcancel process
            $('#sidebarsavecontinuebutton, #savecontinuebutton').bind('click', {} ,function (event) {
                customInstance.onSave(event);
            });

            this.imageServiceInstance = customInstance;

        }
    });

}

