/**
 * Created by ralev on 05.04.17.
 */
define(function () {

    return function(data) {

        var that = this;
        var Events = data.config.events;
        var Attributes = data.factory.attributes;
        var Labels = data.config.labels.ImageServicePresets;

        // Where the UI resides
        that.container = null;
        // The host where the events go
        that.host = data.host;

        // Creates an attributes object that will be used for the UI
        var attributes = Attributes.create({
            definitions: jQuery.extend({}, data.attributes, data.config.systemAttributes),
            dataService: data.service,
            values: data.values
        });

        this.getIdentifier = function () {
            return 'ImageServicePresets'
        };

        this.getValues = function () {
            return attributes.getValues();
        };

        this.setValues = function (values) {
            return attributes.setValues(values);
        };

        /**
         * Makes the preset changes of the model
         * @param model
         * @returns {*}
         */
        this.apply = function (model) {

            if (!model.hasOwnProperty('attributes'))
                return model;

            var values = attributes.getValues();
            model.tags = values.tags;

            return Object.assign(model.attributes, values);
        };

        /**
         * Renders the frontend part
         * @returns {null|jQuery|HTMLElement|*}
         */
        this.render = function () {

            if (that.container)
                that.container.remove();

            that.container = $('<div class="imageservice-attributes-global"><h5>' + Labels.title + '</h5><hr/></div>');
            that.container.append(attributes.render());
            that.host.append(that.container);

            return that.container;
        };

        /**
         * Initialization
         */
        this.init = function () {
            that.host.trigger(Events.PRESETTERREGISTER, this);
            that.host.trigger(Events.SETTINGREGISTER, this);
        };

        this.init();
    }
});