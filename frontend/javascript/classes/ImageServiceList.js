/**
 * Created by ralev on 05.04.17.
 */
define(function () {

    return function(data) {

        var that = this;
        var Events = data.config.events;
        var ListItem = data.factory.listItem;
        var Model = data.factory.model;

        /**
         * Indicates a form change
         * @type {boolean}
         */
        that.dirty = false;

        /**
         * Backened connector service
         * @type {ImageServiceConnector|string}
         */
        that.dataService = data.service;

        /**
         * jQuery element that hosts the current instance of the service
         * @type {jQuery|HTMLElement}
         */
        that.host = data.hostElement;

        /**
         * Object containing the definition of all posible extra fields
         * @type {*|{}}
         */
        that.attributes = data.attributes || {};

        /**
         * Generated Item entities
         * @type {Array}
         */
        that.imageEntities = [];

        /**
         * jQuery object - the list html instance
         * @type {null}
         */
        that.container = null;

        /**
         * The maximal number of items in the list null == without a limit
         * @type {int|null}
         */
        that.maxItems = data.maxItems || null;

        /**
         * Constructor
         */
        that.init = function () {
            that.reset(data.items.items);
            that.addListeners();
        };

        /**
         * Resets the content of the list with new content
         * @param newItems
         */
        that.reset = function (newItems) {

            newItems = newItems || [];

            if (that.container != null)
                that.container.remove();

            that.container = $('<div class="imageservice-list"></div>');
            $(that.host).append(that.container);

            that.imageEntities = [];

            // Add the data to the internal array
            for (var i = 0; i < newItems.length; i++) {
                that.addItem(newItems[i]);
            }

            // Makes the list sortable
            if ($.fn.sortable) {
                that.container.sortable({
                    update: that.onListSorted
                });
            }
        };

        /**
         * Registers the listeners
         */
        that.addListeners = function () {

            // On list saved
            $(that.host).on(Events.LISTSAVED, function (event, newItems) {
                that.dirty = false;
                that.reset(newItems.items);
            });

            // On element change
            $(that.host).on('change', function () {
                that.dirty = true;
            });

            // On new item added
            $(that.host).on(Events.ITEMADDED, function (event, data) {
                if (data.hasOwnProperty('item')) {
                    var newItem = that.addItem(
                        data.item,
                        data.file || null
                    );

                    if (!newItem)
                        return;

                    var offsets = newItem.getOffsets();

                    that.container.animate({scrollTop: offsets.top}, 500);
                    that.dirty = true;
                }
            });

            $(that.host).on(Events.ITEMDELETED, function (event, item) {
                that.dirty = true;
                if (item.getData().status == Model.statuses.EXCLUDE)
                    that.removeItem(item);
            });

            $(that.host).on(Events.ITEMEXCLUDED, function (event, item) {
                that.dirty = true;
                that.removeItem(item);
            });

        };

        /**
         * TODO: Move to a Sorter class
         * @param event
         * @param ui
         */
        that.onListSorted = function (event, ui) {
            var ids = that.container.sortable('toArray');
            var newEntityArray = [];

            that.imageEntities.forEach(function (el) {
                var newIndex = ids.indexOf(el.getId());
                newEntityArray[newIndex] = el;
            });

            that.imageEntities = newEntityArray;
            that.dirty = true;

        };

        /**
         * Return the current data of the list
         * @returns {{items: Array, files: Array}}
         */
        that.getData = function () {

            var items = [];
            var files = [];

            that.imageEntities.forEach(function (entity) {
                items.push(entity.getData());
                files.push(entity.getFile() || null);
            });

            return {
                items: items,
                files: files
            };
        };

        /**
         * Removes an element form the list
         * @param item
         */
        that.removeItem = function (item) {
            var itemIndex = that.imageEntities.indexOf(item);
            if (itemIndex >= 0) {
                that.imageEntities.splice(itemIndex, 1);
            }
        };

        /**
         * Adds a single item to the list
         * @param imageData
         * @param fileData
         * @returns {ImageServiceListItem}
         */
        that.addItem = function (imageData, fileData) {

            if (imageData.status == Model.statuses.DELETED) {
                that.container.trigger(Events.MESSAGEWARNING, 'Added image has a delete status');
                return;
            }

            // Limits the number of files in the list
            if (that.maxItems && that.getListLength() >= that.maxItems) {
                that.container.trigger(Events.MESSAGEWARNING, 'Maximal number of list items reached.');
                return;
            }

            var newEntity = ListItem.create({
                item: jQuery.extend({}, imageData),
                file: fileData,
                definitions: that.attributes,
                dataService: that.dataService,
                prefix: that.host.attr('id') + '_' + that.imageEntities.length
            });

            that.imageEntities.push(newEntity);
            that.container.append(newEntity.render());

            return newEntity;

        };

        /**
         * Returns the active items in the list. Those marked for deletion are not counteted in
         * @returns {*}
         */
        that.getListLength = function () {
            // Gets all items that are not set for deletion
            // TODO: Find a more efficient way to check that
            var activeItems = $(that.imageEntities).filter(function (index, obj) {
                if (obj.getData().status != Model.statuses.DELETED)
                    return true;
            });

            return activeItems.length;
        };

        that.init();

        return that;
    }
});