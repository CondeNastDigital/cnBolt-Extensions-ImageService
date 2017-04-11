define(['ImageServiceSettingsInterface'], function (ImageServiceSettingsInterface) {

    /**
     * Component that renders the Globals Settings Block. Used for configuring the collection of images. It is compatible with an Interface needed by the ImageServiceSettingsInterface
     * @param data {object}
     * @param data.host {object} jQuery object where the component will render its contents, and fire the its events
     * @param data.attributes {object} An object containing the definition of the attributes that the component will render.
     * @param data.service {object} The backend service/connector that the attributes may use for the typeahead fields
     * @param data.values {object} The initial values for the Attributes
     *
     * @param data.config {object} Config cor the Component
     * @param data.config.events {object} Event names that the component needs - SETTINGREGISTER. This event will be fired to notify any Settings Components.
     * @param data.config.labels {object}
     * @param data.factory {object}
     * @param data.factory.attributes {object}
     *
     */
    return function(data) {

        ImageServiceSettingsInterface.call(this, data);

        var that = this;
        var Labels = data.config.labels;

        // Where the UI resides
        that.container = null;
        that.name = 'ImageServiceGlobals';

        /**
         * Renders the frontend part
         * @returns {null|jQuery|HTMLElement|*}
         */
        this.render = function () {

            if (that.container)
                that.container.remove();

            that.container = $('<div class="imageservice-attributes-global"><h5>' + Labels.title + '</h5><hr/></div>');
            that.container.append(that.attributes.render());
            that.host.append(that.container);

            return that.container;
        };

        that.init = function() {
            that.attributes.prefix = that.getIdentifier();
            that.registerSetting();
        };

        that.init();

    };

});