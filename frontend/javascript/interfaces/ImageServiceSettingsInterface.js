define(function(){

    /**
     * Interface / Abstract object for Settings-Blocks
     * @param data {Object}
     * @param data.attributes {Object} Definition of the attributes that the Settings Component
     * @param data.host {Object} jQuery element hosting the events and components html
     * @param data.service {Object} Backened Service
     * @param data.name {Object} Identifier of the settings block
     * @param data.values {Object} Initial values of the Settings component
     * @param data.config {Object} System configuration for the Component
     * @param data.config.events {Object} Component Event-names
     * @param data.factory {Object} Collection of factory objects that the component needs
     * @param data.factory.attributes {Object} Factory Object for generating Attributes Components.
     */
    return function(data) {

        this.Events = data.config.events;

        // The host where the events go
        this.host = data.host;

        this.name = 'ImageServiceSettings';

        // Creates an attributes object this will be used for the UI
        this.attributes = data.factory.attributes.create({
            definitions: data.attributes,
            dataService: data.service,
            values: data.values,
            prefix: this.name
        });

        this.getIdentifier = function () {
            return this.name;
        };

        this.getValues = function () {
            return this.attributes.getValues();
        };

        this.setValues = function (values) {
            this.attributes.setValues(values);
        };

        /**
         * Renders the frontend part
         * @returns {null|jQuery|HTMLElement|*}
         */
        this.render = function () {};

        /**
         * Initialization
         */
        this.registerSetting = function () {
            this.host.trigger(this.Events.SETTINGREGISTER, this);
        };

    }
});