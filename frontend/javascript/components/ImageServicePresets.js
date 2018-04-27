define(['ImageServiceSettingsInterface'], function (ImageServiceSettingsInterface) {

    /**
     * A Component that renders a Settings Block with fields, whose values will be used as Defualt ListItem Attributes Values
     * The component notifies the world that it is a Settings Component and it also is a Presetter, that means that it implements an apply method
     * @param data {Object}
     * @param data.config {Object} System-wide configurations
     * @param data.config.labels {Object} Labels of the Component
     * @param data.factory.attributes {Object} Factory generating an Attributes Componenet based on the Attributes definition
     * @param data.service {Object} Backend service for the attributes
     * @param data.values {Object} Initial values for the Attribute fields
     *
     */
    return function(data) {

        var that = this;

        ImageServiceSettingsInterface.call(this, data);

        var Labels = data.config.labels;
        var systemAttributes = data.config.systemAttributes;

        // Where the UI resides
        that.container = null;

        that.name = 'defaults';

        that.attributes = {};

        /**
         * Makes the preset changes of the model
         * @param model
         * @returns {*}
         */
        that.apply = function (model) {

            if (!model.hasOwnProperty('attributes'))
                return model;

            var values = that.attributes.getValues();

            for(var attr in values) {
                if(systemAttributes.hasOwnProperty((attr)))
                    model[attr] = values[attr];
                else
                    model.attributes[attr] = values[attr];

            }

            return model.attributes;
        };

        /**
         * Renders the frontend part
         * @returns {null|jQuery|HTMLElement|*}
         */
        that.render = function () {

            if (that.container)
                that.container.remove();

            that.container = $('<div class="imageservice-attributes-global"><h5>' + Labels.title + '</h5><hr/></div>');
            that.container.append(that.attributes.render());
            that.host.append(that.container);

            return that.container;
        };

        /**
         * Initialization
         */
        that.init = function () {

            // Creates an attributes object that will be used for the UI
            that.attributes = data.factory.attributes.create({
                definitions: data.attributes,
                dataService: data.service,
                values: data.values,
                prefix: that.name
            });

            this.registerSetting();
            that.host.trigger(that.Events.PRESETTERREGISTER, that);
        };

        that.init();
    };

});