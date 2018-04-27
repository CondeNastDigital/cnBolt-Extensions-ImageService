define(function () {

    /**
     * A Component that renders a row for the ImageServiceList Component.
     * @param data.config {Object}
     * @param data.config.events {Object} Event names that the component knows and fires, ITEMDELETE, ITEMDELETED, ITEMEXCLUDE, ITEMEXCLUDED, PREVIEWREADY
     * @param data.model {Object} An Object containing all the models that Component uses actions and preview:
     * @param data.model.actions {Object} A Component that renders the actions block TODO: Make it a factory
     * @param data.model.preview {Object} A Component that renders the preview TODO: Make it a factory
     * @param data.factory {Object} An Object holding the factories that the Component needs
     * @param data.factory.attributes {Object} The Factory that generates the Attributes Component
     * @param data.factory.dataModel {Object} The Factory that generates an Image Data Model
     *
     * @param data.definitions {Object} Attributes definitions of the Image
     * @param data.dataService {Object} Backend Service
     * @param data.file {Object} The File attached to the ListItem, used for Preview and Save
     *
     */
    return function(data) {

        var that = this;
        var Events = data.config.events;
        var Actions = data.model.actions;
        var Preview = data.model.preview;
        var Attributes = data.factory.attributes;
        var DataModel = data.factory.dataModel;
        var EventsArena = data.eventsArena;
        var IdGenerator = data.factory.idGenerator;
        var systemAttributes = data.config.systemAttributes || {};

        /**
         * Has the info been changed flag
         * @type {boolean}
         */
        var dirty = false;

        /**
         * Item data
         * @type {*|{id: null, service: string, status: string, attributes: {}, tags: Array, options: Array, info: {height: null, width: null, size: null, format: null, source: null, created: null}}}
         */
        var item = DataModel.create(data.item);

        /**
         * The source file for new Items
         * @type {*|CKEDITOR.ui.dialog.file|null}
         */
        var file = data.file || null;

        /**
         * Field definitions
         * @type {*|*|{type: string, label: string}}
         */
        var definitions = data.definitions;

        /**
         * Communication service with the backened
         * @type {*|ImageServiceConnector|string|ImageServiceConnector|string}
         */
        var dataService = data.service;

        /**
         * jQuery Object of the Entity
         * @type {null}
         */
        var container = null;

        /**
         * The unique id of the element
         * @type {string}
         */
        var id = '';

        /**
         * The preview object
         * @type {null}
         */
        var preview = null;

        /**
         * Attributes object
         * @type {null}
         */
        var attributes = null;

        /**
         * The actions object
         * @type {null}
         */
        var actions = null;

        /**
         * Initiates the object
         */
        that.init = function () {

            // creates an unique id of the entity
            id = that.generateId(item.id);//data.prefix + '_' + item.id.replace(/[^a-z0-9\_\-]+/ig, '_');

            // Prepares the attributes
            var attrValues = jQuery.extend({}, item.attributes);

            // Set the system attribute values
            for(var attr in systemAttributes)
                if(item.hasOwnProperty(attr))
                    attrValues[attr] = item[attr];

            // tries to retrieve the item url
            that.presetImage();

            // Loads the standart components
            container = $('<div id="' + id + '" class="col-xs-12 col-sm-12 col-md-12 imageservice-entity"></div>');
            actions = new Actions({
                config: {
                    events: Events
                }
            });
            preview = new Preview({
                item: item,
                config: {
                    events: Events
                },
                factory: {
                    dataModel: DataModel
                }
            });

            for(var attr in data.definitions)
                if(systemAttributes.hasOwnProperty(attr))
                    delete data.definitions[attr];

            attributes = Attributes.create({
                prefix: id,
                values: attrValues,
                definitions: data.definitions,
                dataService: dataService
            });

            // adds the listeners
            that.addListeners();

            // Loads the source file
            if (file)
                that.loadTheFile();
        };

        /**
         * Returns the generated unique element id
         * @returns {string}
         */
        that.getId = function () {
            return id;
        };

        that.generateId = function(itemId) {
            return IdGenerator.generate(itemId);
        };

        /**
         * Returns the Data of the Entity
         * @returns {*|{id: null, service: string, status: string, attributes: {}, tags: Array, options: Array, info: {height: null, width: null, size: null, format: null, source: null, created: null}}}
         */
        that.getData = function () {

            var attrValues = attributes.getValues();

            for (var i in definitions){
                if(systemAttributes.hasOwnProperty(i))
                    item[i] = attrValues[i];
                else
                    item.attributes[i] = attrValues[i];
            }

            return item;
        };

        /**
         * Returns the loaded file. Needed when saving the new entities
         * @returns {*|CKEDITOR.ui.dialog.file|null}
         */
        that.getFile = function () {
            return file;
        };

        /**
         * Gets the offsets related to the parent element
         */
        that.getOffsets = function () {
            return {
                left: container[0].offsetLeft,
                top: container[0].offsetTop
            };
        };

        /**
         * Add listeners to react on attrbutes change and item delete
         */
        that.addListeners = function () {

            // change
            container.on('change', function (event) {
                that.onImageUpdate(event)
            });

            // delete
            container.on(Events.ITEMDELETE, function () {
                that.onItemDelete(true);
            });

            // delete
            $(window).on(Events.ITEMDELETED, function (event, item) {
                that.onItemDeleted(item);
            });

            // exclude
            container.on(Events.ITEMEXCLUDE, function () {
                that.onItemDelete(false);
            });

            // exclude
            $(window).on(Events.ITEMEXCLUDED, function (event, item) {
                that.onItemExcluded(item);
            });

            // exclude
            $(window).on(Events.MESSAGEERROR, function (event, error) {
                if(that.generateId(error.data.id) === that.getId()) {
                    container.addClass('error');
                }
            });

            $(window).on(Events.MESSAGEWARNING, function (event, warning) {
                if(that.generateId(warning.data.id) === that.getId()) {
                    container.addClass('warning');
                }
            });

        };

        /**
         * TODO: Move this logic to the Item service
         */
        that.presetImage = function () {

            if (!item.info.source && item.status == DataModel.statuses.CLEAN) {
                item.info.source = dataService.getImageUrl(item.id, item.service);
            }

            // Php array - to Javascript object
            if (item.attributes instanceof Array) {
                item.attributes = {};
            }
        };

        /**
         * Code to execute on data update
         * @param event
         */
        that.onImageUpdate = function (event) {
            dirty = true;
            if (item.status != DataModel.statuses.NEW)
                item.status = DataModel.statuses.DIRTY;
        };

        /**
         * Code to execute on entity delete
         */
        that.onItemDelete = function (hard) {

            dirty = true;

            if (hard && item.status != DataModel.statuses.NEW) {
                // Delete existing already uploaded images
                item.status = DataModel.statuses.DELETED;
                var responseEvent = Events.ITEMDELETED;
            }
            else {
                // Delete of images that not been uploaded
                var responseEvent = Events.ITEMEXCLUDED;
            }

            that.hide(function () {
                container.trigger(responseEvent, that);
            });

        };

        /**
         * Code to execute on entity delete
         */
        that.onItemDeleted = function (deletedItem) {

            dirty = true;

            if (deletedItem.getData().id != item.id)
                return;

            if (item.status != DataModel.statuses.DELETED) {
                item.status = DataModel.statuses.EXCLUDE;
                container.trigger(Events.ITEMEXCLUDED, that);
            }

            that.hide();
        };


        /**
         * Code to execute on entity delete
         * still no other action required
         */
        that.onItemExcluded = function (excludedItem) {
            return;
        };

        /**
         * Hide the element
         */
        that.hide = function (success) {
            $(container).animate({height: 0, opacity: 0}, 300, function () {
                $(container).hide();
                if (typeof(success) == 'function')
                    success();
            });
        };

        /**
         * Loads the File for the preview
         */
        that.loadTheFile = function () {
            var reader = new FileReader();
            reader.addEventListener("load", function () {
                var URL = window.URL || window.webkitURL || false;
                item.info.source = URL ? URL.createObjectURL(file) : reader.result;
                preview.update(item);
                container.trigger(Events.PREVIEWREADY, item);
            });
            reader.readAsDataURL(file);
        };

        /**
         * Renders the Entity HTML
         * @returns {*}
         */
        that.render = function () {

            var previewContainer = $('<div class="col-xs-12 col-sm-3 col-md-3"></div>').append(preview.render());
            var attributesContainer = $('<div class="col-xs-12 col-sm-8 col-md-8"></div>').append(attributes.render());

            container.append(previewContainer);
            container.append(attributesContainer);
            container.append(actions.render());

            return container;
        };

        that.init();
    }
});